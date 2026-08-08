function Test-CanarySessionTokenFormat {
  param([AllowNull()][string]$Token)
  return -not [string]::IsNullOrWhiteSpace($Token) -and $Token -cmatch '^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\z'
}
