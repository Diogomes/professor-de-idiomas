$ErrorActionPreference = "Stop"

$Body = @{
    model = "professor-idiomas"
    stream = $false
    messages = @(
        @{
            role = "user"
            content = "Monte uma microaula de 5 minutos sobre cumprimentos basicos em japones para iniciante."
        }
    )
} | ConvertTo-Json -Depth 8

$Response = Invoke-RestMethod `
    -Uri "http://localhost:11434/api/chat" `
    -Method Post `
    -ContentType "application/json" `
    -Body $Body

$Response.message.content

