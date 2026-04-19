use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum CmdError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("not a markdown file: {0}")]
    NotMarkdown(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("store error: {0}")]
    Store(String),
    #[error("dialog cancelled")]
    Cancelled,
    #[error("{0}")]
    Other(String),
}

impl Serialize for CmdError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.to_string().as_str())
    }
}

pub type CmdResult<T> = Result<T, CmdError>;
