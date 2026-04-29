use serde::{Deserialize, Serialize};

use crate::error::{CmdError, CmdResult};

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: &'a [ChatMessage],
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicError {
    error: AnthropicErrorDetail,
}

#[derive(Deserialize)]
struct AnthropicErrorDetail {
    message: String,
}

#[tauri::command]
pub async fn ask_ai(
    api_key: String,
    system: String,
    messages: Vec<ChatMessage>,
) -> CmdResult<String> {
    let client = reqwest::Client::new();
    let body = AnthropicRequest {
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: &system,
        messages: &messages,
    };

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| CmdError::Other(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        // Try to parse Anthropic's error format, fall back to raw text
        let err_text = resp.text().await.unwrap_or_default();
        let message = serde_json::from_str::<AnthropicError>(&err_text)
            .map(|e| e.error.message)
            .unwrap_or_else(|_| err_text);
        return Err(CmdError::Other(format!("API {status}: {message}")));
    }

    let data: AnthropicResponse = resp
        .json()
        .await
        .map_err(|e| CmdError::Other(e.to_string()))?;

    Ok(data
        .content
        .into_iter()
        .next()
        .map(|c| c.text)
        .unwrap_or_default())
}
