# node-jenkins-duration-forever

## Usage
```
npm start -- job:Event-Management mark-forever:true url:<projecturl>
```
### Options

job (required)
-
The name of the umbrella project you want to gather infos from
![screenshot](https://d17oy1vhnax1f7.cloudfront.net/items/3x3U0t0t0L1E0O321e2Q/Image%202016-10-13%20at%2010.54.16%20AM.png?v=d28a995f Add the project job name)

url (required)
-
the url of the project

mark-forever
-
This will mark the latest 3 successful builds as `keep forever`
