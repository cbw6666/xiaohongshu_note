import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/xiaohongshu_note/',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/xhs-proxy': {
        target: 'https://www.xiaohongshu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-proxy/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': 'https://www.xiaohongshu.com/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1',
          'upgrade-insecure-requests': '1',
        },
        // 自行处理代理响应，拦截小红书的风控重定向和异常状态
        selfHandleResponse: true,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const statusCode = proxyRes.statusCode
            const location = proxyRes.headers['location'] || ''

            // 检测小红书风控重定向（302 到 /404/sec_xxx）
            if ((statusCode >= 301 && statusCode <= 308) && (location.includes('/404/sec_') || location.includes('error_code'))) {
              let errorMsg = '该笔记暂时无法浏览（小红书风控拦截）'
              try {
                const urlObj = new URL(location.startsWith('http') ? location : 'https://www.xiaohongshu.com' + location)
                const msg = urlObj.searchParams.get('error_msg')
                if (msg) errorMsg = decodeURIComponent(msg)
              } catch {}

              res.writeHead(403, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
              })
              res.end(JSON.stringify({ error: true, message: errorMsg, blocked: true }))
              return
            }

            // 检测非 200 的异常状态码（461、403、471 等小红书风控码）
            if (statusCode === 461 || statusCode === 471 || (statusCode === 403 && !req.url.includes('/xhs-img'))) {
              res.writeHead(403, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
              })
              res.end(JSON.stringify({
                error: true,
                message: `小红书反爬拦截 (${statusCode})，请稍后重试`,
                blocked: true,
              }))
              return
            }

            // 正常响应：手动转发，清理有问题的 CORS 头
            const headers = { ...proxyRes.headers }
            delete headers['access-control-allow-origin']
            delete headers['access-control-allow-credentials']
            headers['access-control-allow-origin'] = '*'
            res.writeHead(proxyRes.statusCode, headers)
            proxyRes.pipe(res)
          })
        }
      },
      '/xhs-img': {
        target: 'https://sns-img-bd.xhscdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-img/, ''),
        headers: {
          'Referer': 'https://www.xiaohongshu.com/',
        }
      },
      '/xhs-img-qc': {
        target: 'https://sns-img-qc.xhscdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-img-qc/, ''),
        headers: {
          'Referer': 'https://www.xiaohongshu.com/',
        }
      },
      '/xhs-img-hw': {
        target: 'https://sns-img-hw.xhscdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-img-hw/, ''),
        headers: {
          'Referer': 'https://www.xiaohongshu.com/',
        }
      },
      '/xhs-webpic': {
        target: 'https://sns-webpic-qc.xhscdn.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-webpic/, ''),
        headers: {
          'Referer': 'https://www.xiaohongshu.com/',
        }
      },
      '/xhs-ci': {
        target: 'https://ci.xiaohongshu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xhs-ci/, ''),
        headers: {
          'Referer': 'https://www.xiaohongshu.com/',
        }
      }
    }
  }
})
