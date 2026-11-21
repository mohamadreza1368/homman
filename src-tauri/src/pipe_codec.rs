//! Buffer management and frame decoding for newline-delimited IPC streams.

/// Maximum line length allowed in bytes (64 KB).
pub const MAX_LINE_BYTES: usize = 64 * 1024;

/// Result of attempting to decode a line from the accumulated stream buffer.
#[derive(Debug, PartialEq, Eq)]
pub enum DecodeResult {
    /// A complete newline-delimited frame was extracted.
    Frame(String),
    /// Incomplete stream; more bytes needed from the transport.
    NeedsMore,
    /// Stream exceeded the maximum permissible line length without a newline.
    TooLong,
}

/// Accumulating buffer for stream decoding with upper-bound protection.
#[derive(Debug, Default)]
pub struct LineDecoder {
    buffer: Vec<u8>,
}

impl LineDecoder {
    /// Creates a new, empty decoder with default capacity.
    pub fn new() -> Self {
        Self {
            buffer: Vec::with_capacity(4096),
        }
    }

    /// Ingests incoming raw bytes into the internal accumulation buffer.
    pub fn ingest(&mut self, bytes: &[u8]) {
        self.buffer.extend_from_slice(bytes);
    }

    /// Pulls the next complete frame if available.
    pub fn poll_next(&mut self) -> DecodeResult {
        if let Some(pos) = self.buffer.iter().position(|&b| b == b'\n') {
            let mut line_bytes: Vec<u8> = self.buffer.drain(..=pos).collect();
            // Remove trailing newline
            line_bytes.pop();
            // Remove optional carriage return
            if line_bytes.last() == Some(&b'\r') {
                line_bytes.pop();
            }
            return DecodeResult::Frame(String::from_utf8_lossy(&line_bytes).into_owned());
        }

        if self.buffer.len() >= MAX_LINE_BYTES {
            DecodeResult::TooLong
        } else {
            DecodeResult::NeedsMore
        }
    }

    /// Clears any lingering pending data (e.g. on transport disconnect).
    pub fn reset(&mut self) {
        self.buffer.clear();
    }

    /// Returns the count of bytes currently buffered awaiting completion.
    pub fn pending_len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_complete_line() {
        let mut decoder = LineDecoder::new();
        decoder.ingest(b"hello world\n");
        assert_eq!(
            decoder.poll_next(),
            DecodeResult::Frame("hello world".into())
        );
        assert_eq!(decoder.poll_next(), DecodeResult::NeedsMore);
    }

    #[test]
    fn strips_carriage_return() {
        let mut decoder = LineDecoder::new();
        decoder.ingest(b"status ok\r\n");
        assert_eq!(decoder.poll_next(), DecodeResult::Frame("status ok".into()));
    }

    #[test]
    fn assembles_chunked_input() {
        let mut decoder = LineDecoder::new();
        decoder.ingest(b"part1 ");
        assert_eq!(decoder.poll_next(), DecodeResult::NeedsMore);
        decoder.ingest(b"part2\n");
        assert_eq!(
            decoder.poll_next(),
            DecodeResult::Frame("part1 part2".into())
        );
    }

    #[test]
    fn detects_line_too_long() {
        let mut decoder = LineDecoder::new();
        let chunk = vec![b'x'; MAX_LINE_BYTES + 10];
        decoder.ingest(&chunk);
        assert_eq!(decoder.poll_next(), DecodeResult::TooLong);
    }
}
