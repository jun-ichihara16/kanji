import http.server, os, sys
os.chdir('/Users/jun-ichihara/Desktop/kanji')
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=8080, bind='127.0.0.1')