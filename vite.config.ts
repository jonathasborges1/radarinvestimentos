import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const DB_DIR      = resolve(__dirname, 'data')
const DB_PATH     = resolve(DB_DIR, 'db.json')
const PREFS_PATH  = resolve(DB_DIR, 'preferences.json')
const FILTERS_PATH = resolve(DB_DIR, 'filters.json')

function ensureDb() {
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR)
  if (!existsSync(DB_PATH))      writeFileSync(DB_PATH,      '[]',  'utf-8')
  if (!existsSync(PREFS_PATH))   writeFileSync(PREFS_PATH,   'null', 'utf-8')
  if (!existsSync(FILTERS_PATH)) writeFileSync(FILTERS_PATH, 'null', 'utf-8')
}

function writeIfChanged(filePath: string, output: string) {
  const current = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null
  if (current !== output) writeFileSync(filePath, output, 'utf-8')
}

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/data/*.json'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'json-db',
      configureServer(server) {
        ensureDb()
        function makeHandler(filePath: string) {
          return (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            if (req.method === 'GET') {
              res.end(readFileSync(filePath, 'utf-8'))
            } else if (req.method === 'PUT') {
              let body = ''
              req.on('data', (chunk: Buffer) => { body += chunk.toString() })
              req.on('end', () => {
                let output = body
                try {
                  output = JSON.stringify(JSON.parse(body), null, 2) + '\n'
                } catch {
                  // Body não é JSON válido — grava como veio para preservar o erro do cliente.
                }
                writeIfChanged(filePath, output)
                res.end('{"ok":true}')
              })
            } else {
              res.statusCode = 405
              res.end('{"error":"Method not allowed"}')
            }
          }
        }

        server.middlewares.use('/api/assets',      makeHandler(DB_PATH))
        server.middlewares.use('/api/preferences', makeHandler(PREFS_PATH))
        server.middlewares.use('/api/filters',     makeHandler(FILTERS_PATH))
      },
    },
  ],
})
