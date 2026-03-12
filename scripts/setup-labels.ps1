# GitHub Label Management Script
# This script standardizes the labels in your repository for a professional look.

$labels = @(
    @{ Name = "bug"; Color = "d73a4a"; Description = "Something isn't working" },
    @{ Name = "enhancement"; Color = "a2eeef"; Description = "New feature or request" },
    @{ Name = "security"; Color = "000000"; Description = "Critical security vulnerability" },
    @{ Name = "documentation"; Color = "0075ca"; Description = "Improvements or additions to documentation" },
    @{ Name = "performance"; Color = "ccff00"; Description = "Performance optimization" },
    @{ Name = "ui/ux"; Color = "fef2c0"; Description = "Visual or usability improvements" },
    @{ Name = "good first issue"; Color = "7057ff"; Description = "Good for newcomers" }
)

Write-Host "To use this script, you must have the GitHub CLI (gh) installed and authenticated." -ForegroundColor Yellow
Write-Host "Run the following command for each label (example):" -ForegroundColor Cyan
Write-Host "gh label create 'bug' --color 'd73a4a' --description 'Something isn't working'"

# Optional: Uncomment to run automatically if GH CLI is present
# foreach ($l in $labels) {
#    gh label create $l.Name --color $l.Color --description $l.Description --force
# }
