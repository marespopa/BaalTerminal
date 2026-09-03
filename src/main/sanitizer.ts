/**
 * Redacts credentials and secret-like values from terminal output before it is
 * exposed to AI utilities (e.g. the MCP `get_tab_output` tool). Patterns are
 * intentionally broad/greedy since false-positive redaction is far cheaper
 * than leaking a real secret.
 */

const REDACTED = '[REDACTED]';

const PROVIDER_TOKEN_PATTERN =
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g;
const GITHUB_TOKEN_PATTERN = /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}\b/g;
const AWS_KEY_PATTERN = /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g;
const SLACK_TOKEN_PATTERN = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const GOOGLE_API_KEY_PATTERN = /\bAIza[A-Za-z0-9_-]{35}\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PRIVATE_KEY_BLOCK_PATTERN = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const CREDENTIALED_URL_PATTERN = /(\b[a-z][a-z0-9+.-]*:\/\/)([^\s'"`:@/]+):([^\s'"`@/]+)@/gi;
const BEARER_TOKEN_PATTERN = /(authorization\s*[:=]\s*bearer\s+)[^\s'"`]+/gi;
const LABELED_SECRET_PATTERN =
  /((?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|session[_-]?token|private[_-]?key|password|passwd|secret)\s*[:=]\s*)[^\s'"`]+/gi;
const ENV_STYLE_SECRET_PATTERN =
  /^([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*\s*=\s*)(.+)$/gim;
const HIGH_ENTROPY_PATTERN = /\b[A-Za-z0-9+/_-]{40,}={0,2}\b/g;

export function sanitizeOutput(output: string): string {
  return output
    .replace(PRIVATE_KEY_BLOCK_PATTERN, REDACTED)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED}`)
    .replace(LABELED_SECRET_PATTERN, `$1${REDACTED}`)
    .replace(ENV_STYLE_SECRET_PATTERN, `$1${REDACTED}`)
    .replace(CREDENTIALED_URL_PATTERN, `$1$2:${REDACTED}@`)
    .replace(PROVIDER_TOKEN_PATTERN, REDACTED)
    .replace(GITHUB_TOKEN_PATTERN, REDACTED)
    .replace(AWS_KEY_PATTERN, REDACTED)
    .replace(SLACK_TOKEN_PATTERN, REDACTED)
    .replace(GOOGLE_API_KEY_PATTERN, REDACTED)
    .replace(JWT_PATTERN, REDACTED)
    .replace(HIGH_ENTROPY_PATTERN, REDACTED);
}
