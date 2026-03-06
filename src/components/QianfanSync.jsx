import { useState, useEffect, useCallback, useRef } from 'react'

// 脚本提取数据后通过多通道发送：BroadcastChannel + postMessage + console输出JSON
// BroadcastChannel 是同源跨标签页通信，但千帆和本工具不同源所以不行
// postMessage 需要 opener 引用，微前端架构下容易丢失
// 最可靠方案：提取后直接在控制台打印JSON，提示用户复制粘贴
const SYNC_SCRIPT = `(function(){
console.log('=== 🔗 千帆同步脚本 ===');
console.log('正在提取页面数据...');

var shopName='',shopId='',products=[];

// 1. 获取店铺名
try{
  var shopEls=[
    document.querySelector('[class*="shop-name"],[class*="shopName"],[class*="store-name"],[class*="storeName"]'),
    document.querySelector('.shop-info .name,.store-info .name'),
    document.querySelector('header .name,nav .name,.sidebar .name'),
  ].filter(Boolean);
  if(shopEls.length>0)shopName=shopEls[0].textContent.trim();
  if(!shopName){
    var t=document.title;
    shopName=t.replace(/[-|–—].*/,'').replace(/千帆|后台|管理/g,'').trim()||'';
  }
  if(!shopName)shopName='千帆店铺';
}catch(e){}

// 2. 提取商品 - 策略A：表格行
try{
  document.querySelectorAll('table').forEach(function(table){
    table.querySelectorAll('tbody tr').forEach(function(row){
      var cells=row.querySelectorAll('td');
      if(cells.length<2)return;
      var texts=[];
      cells.forEach(function(c){texts.push(c.innerText.trim())});
      var name='',id='';
      texts.forEach(function(t){
        if(/^[a-f0-9]{20,}$/.test(t)&&!id)id=t;
        else if(/^\\d{6,}$/.test(t)&&!id)id=t;
        else if(t.length>name.length&&t.length>2&&t.length<200)name=t;
      });
      if(name)products.push({productId:id,name:name,description:''});
    });
  });
}catch(e){}

// 策略B：商品卡片
if(products.length===0){
  try{
    var sel=[
      '[class*="product-item"],[class*="productItem"],[class*="ProductItem"]',
      '[class*="goods-item"],[class*="goodsItem"],[class*="GoodsItem"]',
      '[class*="product-card"],[class*="productCard"],[class*="ProductCard"]',
      '[class*="goods-card"],[class*="goodsCard"],[class*="GoodsCard"]',
      '[class*="spu-item"],[class*="spuItem"],[class*="SpuItem"]',
      '[class*="item-row"],[class*="itemRow"],[class*="ItemRow"]',
      '[class*="list-item"],[class*="listItem"]',
    ].join(',');
    document.querySelectorAll(sel).forEach(function(item){
      var text=item.innerText.trim();
      if(text.length<3||text.length>500)return;
      var lines=text.split('\\n').map(function(s){return s.trim()}).filter(function(s){return s.length>0});
      var name='',id='';
      lines.forEach(function(line){
        if(/^[a-f0-9]{20,}$/.test(line)&&!id)id=line;
        else if(/^\\d{6,}$/.test(line)&&!id)id=line;
        else if(line.length>name.length&&line.length>2&&line.length<200&&!/^[¥￥$]/.test(line)&&!/^\\d+(\\.\\d+)?$/.test(line))name=line;
      });
      if(name)products.push({productId:id,name:name,description:''});
    });
  }catch(e){}
}

// 策略C：链接提取
if(products.length===0){
  try{
    document.querySelectorAll('a[href*="product"],a[href*="goods"],a[href*="spu"],a[href*="item"],a[href*="detail"]').forEach(function(a){
      var name=a.innerText.trim();
      if(!name||name.length<3||name.length>200)return;
      if(/首页|管理|设置|订单|数据|营销|客服|物流/g.test(name))return;
      var match=a.href.match(/(?:product|goods|spu|item|detail)[/=]([a-f0-9]+)/i);
      var id=match?match[1]:'';
      products.push({productId:id,name:name,description:''});
    });
  }catch(e){}
}

// 策略D：React/Vue状态
if(products.length===0){
  try{
    var root=document.getElementById('root')||document.getElementById('app')||document.querySelector('#micro-app,#sub-app,[id*="app"]');
    if(root){
      var key=Object.keys(root).find(function(k){return k.startsWith('__reactFiber')||k.startsWith('__reactInternalInstance')});
      if(key){
        var collected=[];
        function walkFiber(fiber,depth){
          if(!fiber||depth>20)return;
          try{
            var state=fiber.memoizedState;
            while(state){
              if(state.queue&&state.queue.lastRenderedState){
                var s=state.queue.lastRenderedState;
                if(typeof s==='object'&&s!==null){
                  try{
                    function findArr(obj,d){
                      if(!obj||d>6||typeof obj!=='object')return;
                      if(Array.isArray(obj)&&obj.length>0){
                        var f=obj[0];
                        if(f&&typeof f==='object'){
                          var hasName=f.title||f.name||f.goodsName||f.productName||f.itemName||f.spuName;
                          if(hasName&&obj.length>collected.length)collected=obj;
                        }
                      }else if(!Array.isArray(obj)){
                        for(var k in obj){if(obj.hasOwnProperty(k)&&typeof obj[k]==='object')findArr(obj[k],d+1)}
                      }
                    }
                    findArr(s,0);
                  }catch(e2){}
                }
              }
              state=state.next;
            }
          }catch(e){}
          if(fiber.child)walkFiber(fiber.child,depth+1);
          if(fiber.sibling)walkFiber(fiber.sibling,depth+1);
        }
        walkFiber(root[key],0);
        if(collected.length>0){
          collected.forEach(function(item){
            products.push({
              productId:String(item.spuId||item.itemId||item.goodsId||item.productId||item.id||''),
              name:item.title||item.name||item.goodsName||item.productName||item.itemName||item.spuName||'',
              description:item.desc||item.subTitle||item.description||item.brief||''
            });
          });
        }
      }
    }
  }catch(e){}
}

// 去重
var seen=new Set();
products=products.filter(function(p){
  var key=p.productId||p.name;
  if(!key||seen.has(key))return false;
  seen.add(key);
  return true;
});

console.log('');
console.log('店铺名:',shopName);
console.log('商品数:',products.length);

if(products.length>0){
  var result={shopName:shopName,shopId:shopId,products:products};
  
  // 尝试多通道发送
  var sent=false;
  // 通道1: postMessage via opener
  try{
    if(window.opener&&!window.opener.closed){
      window.opener.postMessage({source:'qianfan-sync',type:'data',shop:result},'*');
      sent=true;
      console.log('✅ 数据已通过 postMessage 发送');
    }
  }catch(e){}
  
  // 通道2: BroadcastChannel (同源才有效，但试一下)
  try{
    var bc=new BroadcastChannel('qianfan-sync');
    bc.postMessage({source:'qianfan-sync',type:'data',shop:result});
    bc.close();
  }catch(e){}

  // 无论如何都输出JSON方便手动复制
  var jsonStr=JSON.stringify(result,null,2);
  console.log('');
  console.log('========== 📋 请复制下方JSON数据 ==========');
  console.log(jsonStr);
  console.log('========== 📋 复制到此处结束 ==========');
  console.log('');
  
  if(!sent){
    console.log('⚠️ 自动同步失败（opener引用丢失），请手动操作：');
    console.log('1. 选中上方的JSON数据（从 { 到 } ）');
    console.log('2. 右键 → 复制');
    console.log('3. 回到工具页面，点击「手动粘贴JSON」，粘贴后导入');
  }else{
    console.log('💡 如果工具页面没有自动显示数据，也可以复制上方JSON手动粘贴');
  }
  
  // 同时尝试复制到剪贴板（需要页面聚焦）
  try{
    var ta=document.createElement('textarea');
    ta.value=jsonStr;
    ta.style.position='fixed';
    ta.style.left='-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    console.log('✅ JSON已复制到剪贴板');
  }catch(e){
    console.log('💡 自动复制失败，请手动选中JSON并复制');
  }
}else{
  console.log('');
  console.log('❌ 未提取到商品数据');
  console.log('请确保当前在商品管理→商品列表页面，且页面上有商品');
}
})();`

export default function QianfanSync({ onImport }) {
  const [status, setStatus] = useState('idle') // idle | waiting | syncing | done | error | manual
  const [message, setMessage] = useState('')
  const [syncedShop, setSyncedShop] = useState(null)
  const [scriptCopied, setScriptCopied] = useState(false)
  const [manualJson, setManualJson] = useState('')
  const [manualError, setManualError] = useState('')
  const qianfanWinRef = useRef(null)

  // 监听 postMessage + BroadcastChannel
  const handleMessage = useCallback((event) => {
    let data = event.data
    // BroadcastChannel 的 event.data 结构和 postMessage 一样
    if (!data || data.source !== 'qianfan-sync') return

    if (data.type === 'data' && data.shop) {
      setStatus('done')
      setMessage(`同步完成！店铺: ${data.shop.shopName}，共 ${data.shop.products.length} 个商品`)
      setSyncedShop(data.shop)
    } else if (data.type === 'error') {
      setStatus('error')
      setMessage(data.message || '同步失败')
    }
  }, [])

  useEffect(() => {
    // 监听 postMessage
    window.addEventListener('message', handleMessage)

    // 监听 BroadcastChannel
    let bc
    try {
      bc = new BroadcastChannel('qianfan-sync')
      bc.onmessage = handleMessage
    } catch (e) { /* BroadcastChannel not supported */ }

    return () => {
      window.removeEventListener('message', handleMessage)
      if (bc) bc.close()
    }
  }, [handleMessage])

  const handleOpenQianfan = () => {
    setSyncedShop(null)
    setScriptCopied(false)

    const win = window.open(
      'https://ark.xiaohongshu.com',
      'qianfan_window',
      'width=1200,height=800,left=100,top=100'
    )

    if (!win) {
      setStatus('error')
      setMessage('浏览器拦截了弹窗，请允许本站弹窗权限后重试')
      return
    }

    qianfanWinRef.current = win
    setStatus('waiting')
  }

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(SYNC_SCRIPT)
      setScriptCopied(true)
    } catch {
      // fallback
      try {
        const ta = document.createElement('textarea')
        ta.value = SYNC_SCRIPT
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setScriptCopied(true)
      } catch {
        setScriptCopied(false)
      }
    }
  }

  const handleConfirmImport = () => {
    if (syncedShop) {
      onImport(syncedShop)
      setSyncedShop(null)
      setStatus('idle')
      setMessage('')
      setScriptCopied(false)
    }
  }

  // 手动JSON导入 - 支持更灵活的格式
  const handleManualImport = () => {
    setManualError('')
    const raw = manualJson.trim()
    if (!raw) return

    try {
      const data = JSON.parse(raw)
      const shopList = Array.isArray(data) ? data : [data]
      const shop = shopList[0]
      if (!shop) { setManualError('JSON为空'); return }

      const result = {
        shopName: shop.shopName || shop.name || '千帆店铺',
        shopId: shop.shopId || shop.id || '',
        products: (shop.products || shop.items || shop.list || []).map(p => ({
          productId: String(p.productId || p.spuId || p.itemId || p.id || ''),
          name: p.name || p.title || '',
          description: p.description || p.desc || '',
        })),
      }

      if (result.products.length === 0) {
        setManualError('未找到商品数据，请检查JSON格式')
        return
      }

      setSyncedShop(result)
      setStatus('done')
      setMessage(`解析完成！店铺: ${result.shopName}，共 ${result.products.length} 个商品`)
    } catch (e) {
      setManualError('JSON解析失败: ' + e.message)
    }
  }

  const handleClose = () => {
    if (qianfanWinRef.current && !qianfanWinRef.current.closed) {
      qianfanWinRef.current.close()
    }
    qianfanWinRef.current = null
    setStatus('idle')
    setMessage('')
    setSyncedShop(null)
    setScriptCopied(false)
    setManualJson('')
    setManualError('')
  }

  return (
    <div className="qianfan-sync">
      <div className="sync-header">
        <h3>🔗 千帆数据同步</h3>
        {status !== 'idle' && (
          <button className="btn-link" onClick={handleClose}>重置</button>
        )}
      </div>

      {/* 状态提示 */}
      {(status === 'syncing' || status === 'done' || status === 'error') && (
        <div className={`sync-status sync-status-${status === 'syncing' ? 'opening' : status}`}>
          <span className="sync-indicator">
            {status === 'syncing' && '🔄'}
            {status === 'done' && '✅'}
            {status === 'error' && '❌'}
          </span>
          <span style={{ whiteSpace: 'pre-line' }}>{message}</span>
        </div>
      )}

      <div className="sync-actions">
        {/* 初始状态 */}
        {status === 'idle' && (
          <div className="sync-intro">
            <p>从千帆后台同步店铺和商品数据</p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn-primary btn-lg" onClick={handleOpenQianfan}>
                🔗 打开千帆并同步
              </button>
              <button className="btn-secondary" onClick={() => setStatus('manual')}>
                📋 手动粘贴JSON
              </button>
            </div>
          </div>
        )}

        {/* 引导步骤 */}
        {status === 'waiting' && (
          <div className="sync-steps">
            <div className="sync-step">
              <div className="sync-step-num done">1</div>
              <div className="sync-step-content">
                <strong>登录千帆，进入商品列表页面</strong>
                <p className="step-desc">千帆窗口已打开，请登录后进入「商品管理」→ 确保商品列表已显示</p>
                <button className="btn-secondary btn-sm" onClick={handleOpenQianfan}>
                  🔗 重新打开千帆
                </button>
              </div>
            </div>

            <div className="sync-step">
              <div className={`sync-step-num ${scriptCopied ? 'done' : ''}`}>2</div>
              <div className="sync-step-content">
                <strong>复制同步脚本</strong>
                <button
                  className={`btn-sm ${scriptCopied ? 'btn-success' : 'btn-primary'}`}
                  onClick={handleCopyScript}
                  style={{ marginTop: 4 }}
                >
                  {scriptCopied ? '✅ 已复制' : '📋 复制同步脚本'}
                </button>
              </div>
            </div>

            <div className="sync-step">
              <div className="sync-step-num">3</div>
              <div className="sync-step-content">
                <strong>在千帆窗口的控制台执行</strong>
                <div className="step-instructions">
                  <div className="instruction-item">
                    <kbd>F12</kbd> <span>打开开发者工具</span>
                  </div>
                  <div className="instruction-item">
                    <span>切换到</span> <kbd>Console</kbd> <span>标签</span>
                  </div>
                  <div className="instruction-item warning">
                    <span>⚠️ 首次粘贴需先输入</span> <kbd>allow pasting</kbd> <span>回车</span>
                  </div>
                  <div className="instruction-item">
                    <kbd>{navigator.platform?.includes('Mac') ? '⌘V' : 'Ctrl+V'}</kbd> <span>粘贴脚本，按</span> <kbd>Enter</kbd> <span>执行</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sync-step">
              <div className="sync-step-num">4</div>
              <div className="sync-step-content">
                <strong>复制控制台输出的JSON数据</strong>
                <p className="step-desc">脚本执行后会在控制台输出JSON数据，选中复制后回到本页面粘贴导入</p>
                <button className="btn-primary btn-sm" onClick={() => setStatus('manual')} style={{ marginTop: 4 }}>
                  📋 我已复制JSON，去粘贴
                </button>
              </div>
            </div>

            <div className="sync-step-alt">
              <button className="btn-link" onClick={() => setStatus('manual')}>
                直接手动粘贴JSON →
              </button>
            </div>
          </div>
        )}

        {/* 同步中 */}
        {status === 'syncing' && (
          <div className="sync-loading">
            <div className="sync-spinner"></div>
            <p className="hint">正在从千帆同步数据...</p>
          </div>
        )}

        {/* 错误 */}
        {status === 'error' && (
          <div className="sync-error-actions">
            <div className="btn-row">
              <button className="btn-primary" onClick={() => setStatus('manual')}>
                📋 手动粘贴JSON
              </button>
              <button className="btn-secondary" onClick={() => { setStatus('waiting'); setMessage('') }}>
                🔄 重试
              </button>
            </div>
          </div>
        )}

        {/* 手动粘贴JSON */}
        {status === 'manual' && (
          <div className="manual-import">
            <p className="step-desc" style={{ marginBottom: 8 }}>
              粘贴从千帆控制台复制的JSON数据：
            </p>
            <textarea
              className="manual-textarea"
              value={manualJson}
              onChange={e => setManualJson(e.target.value)}
              placeholder={`粘贴脚本在千帆控制台输出的JSON数据，格式如：
{
  "shopName": "上岸小叮当的店",
  "products": [
    { "productId": "69a3121d...", "name": "26新考研复试提分资料..." },
    { "productId": "69a291d1...", "name": "公考职业能力倾向测验..." }
  ]
}`}
              rows={10}
            />
            {manualError && <p className="sync-error-msg">{manualError}</p>}
            <div className="btn-row">
              <button className="btn-primary" onClick={handleManualImport} disabled={!manualJson.trim()}>
                导入
              </button>
              <button className="btn-secondary" onClick={() => { setStatus('waiting'); setManualError('') }}>
                返回步骤说明
              </button>
            </div>
          </div>
        )}

        {/* 同步完成 - 预览 */}
        {status === 'done' && syncedShop && (
          <div className="sync-result">
            <div className="sync-result-card">
              <div className="sync-result-header">
                <strong>🏪 {syncedShop.shopName}</strong>
                {syncedShop.shopId && <span className="product-id">ID: {syncedShop.shopId}</span>}
              </div>
              <div className="sync-result-products">
                <p className="hint" style={{ marginBottom: 8 }}>共 {syncedShop.products.length} 个商品：</p>
                <div className="sync-product-list">
                  {syncedShop.products.slice(0, 10).map((p, i) => (
                    <div key={i} className="sync-product-item">
                      {p.productId && <span className="product-id">{p.productId}</span>}
                      <span>{p.name}</span>
                    </div>
                  ))}
                  {syncedShop.products.length > 10 && (
                    <p className="hint">... 还有 {syncedShop.products.length - 10} 个商品</p>
                  )}
                </div>
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn-primary btn-lg" onClick={handleConfirmImport}>
                ✅ 确认导入
              </button>
              <button className="btn-secondary" onClick={() => { setStatus('waiting'); setMessage(''); setSyncedShop(null) }}>
                🔄 重新同步
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
