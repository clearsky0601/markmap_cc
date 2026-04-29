use serde::{Deserialize, Serialize};

use crate::error::{CmdError, CmdResult};

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
struct OpenAIRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    max_tokens: u32,
}

#[derive(Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

/// Try to extract a human-readable error message from a non-2xx response body.
/// Handles the common `{"error":{"message":"..."}}` shape used by most providers.
async fn extract_error(resp: reqwest::Response) -> String {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    #[derive(Deserialize)]
    struct ErrDetail {
        message: String,
    }
    #[derive(Deserialize)]
    struct ErrWrapper {
        error: ErrDetail,
    }

    let msg = serde_json::from_str::<ErrWrapper>(&body)
        .map(|e| e.error.message)
        .unwrap_or_else(|_| body);

    format!("HTTP {status}: {msg}")
}

/// Generic OpenAI-compatible chat-completion command.
///
/// `base_url`  – provider root, e.g. "https://api.openai.com" or
///               "http://localhost:11434/v1".  We append
///               "/chat/completions" (normalising double slashes).
/// `api_key`   – Bearer token; may be empty for local providers (Ollama).
/// `model`     – model identifier, e.g. "gpt-4o", "deepseek-chat".
/// `messages`  – full conversation including the system message as the
///               first element (role = "system").
#[tauri::command]
pub async fn ask_ai(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
) -> CmdResult<String> {
    let base = base_url.trim_end_matches('/');
    let endpoint = if base.ends_with("/chat/completions") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/chat/completions")
    } else {
        format!("{base}/v1/chat/completions")
    };

    let body = OpenAIRequest {
        model: &model,
        messages: &messages,
        max_tokens: 4096,
    };

    let mut req = reqwest::Client::new()
        .post(&endpoint)
        .header("content-type", "application/json")
        .json(&body);

    if !api_key.is_empty() {
        req = req.header("authorization", format!("Bearer {api_key}"));
    }

    let resp = req
        .send()
        .await
        .map_err(|e| CmdError::Other(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(CmdError::Other(extract_error(resp).await));
    }

    let data: OpenAIResponse = resp
        .json()
        .await
        .map_err(|e| CmdError::Other(e.to_string()))?;

    Ok(data
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .unwrap_or_default())
}
