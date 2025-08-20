#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

# create a simple index.html that redirects to taskpane.html
echo '<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0; url=taskpane.html">
    <title>Math Equation Editor Add-in</title>
</head>
<body>
    <p>Redirecting to the add-in...</p>
</body>
</html>' > index.html

# if you are deploying to a custom domain
# echo 'www.example.com' > CNAME

git init
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
# replace with your GitHub username and repository name
git push -f git@github.com:<USERNAME>/<REPO>.git main:gh-pages

cd -