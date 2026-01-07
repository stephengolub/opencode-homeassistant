var R=Object.defineProperty;var O=(m,h,e)=>h in m?R(m,h,{enumerable:!0,configurable:!0,writable:!0,value:e}):m[h]=e;var r=(m,h,e)=>(O(m,typeof h!="symbol"?h+"":h,e),e);function q(m){return`opencode_history_${m}`}var E={idle:{icon:"mdi:sleep",color:"#4caf50",label:"Idle"},working:{icon:"mdi:cog",color:"#2196f3",label:"Working"},waiting_permission:{icon:"mdi:shield-alert",color:"#ff9800",label:"Needs Permission"},error:{icon:"mdi:alert-circle",color:"#f44336",label:"Error"},unknown:{icon:"mdi:help-circle",color:"#9e9e9e",label:"Unknown"}},_=class _ extends HTMLElement{constructor(){super(...arguments);r(this,"_hass");r(this,"_config");r(this,"_devices",new Map);r(this,"_deviceRegistry",new Map);r(this,"_entityRegistry",new Map);r(this,"_initialized",!1);r(this,"_showPermissionModal",!1);r(this,"_activePermission",null);r(this,"_selectedDeviceId",null);r(this,"_showPromptModal",!1);r(this,"_promptCommandTopic",null);r(this,"_showHistoryView",!1);r(this,"_historyLoading",!1);r(this,"_historyData",null);r(this,"_historyDeviceId",null);r(this,"_historyCommandTopic",null);r(this,"_historyResponseTopic",null);r(this,"_mqttUnsubscribe",null);r(this,"_historyVisibleCount",10);r(this,"_historyLoadingMore",!1);r(this,"_pendingPermissions",new Map);r(this,"_lastRenderHash","")}set hass(e){if(this._hass=e,!this._initialized)this._initialize();else{if(this._updateDevices(),this._showPromptModal||this._showHistoryView)return;if(this._showPermissionModal&&this._activePermission){let i=this._findDeviceIdForPermission(this._activePermission);if(i){let s=this._pendingPermissions.get(i);if(s&&s.permission_id&&!this._activePermission.permission_id){this._activePermission=s,this._render();return}}return}let t=this._computeStateHash();t!==this._lastRenderHash&&(this._lastRenderHash=t,this._render())}}_computeStateHash(){let e=[];for(let[t,i]of this._devices){let s=i.entities.get("state"),o=i.entities.get("session_title"),n=i.entities.get("model"),a=i.entities.get("current_tool"),c=i.entities.get("cost"),g=i.entities.get("tokens_input"),d=i.entities.get("tokens_output"),l=i.entities.get("permission"),v=i.entities.get("last_activity"),p=s?.attributes?.agent,u=s?.attributes?.current_agent;e.push(`${t}:${s?.state}:${o?.state}:${n?.state}:${a?.state}:${c?.state}:${g?.state}:${d?.state}:${l?.state}:${v?.state}:${p}:${u}`),l?.state==="pending"&&e.push(`perm:${l.attributes?.permission_id}`)}for(let[t,i]of this._pendingPermissions)e.push(`pending:${t}:${i.permission_id}`);return e.join("|")}_findDeviceIdForPermission(e){for(let[t,i]of this._devices)if(i.entities.get("device_id")?.attributes?.command_topic===e.commandTopic)return t;return null}setConfig(e){this._config=e}async _initialize(){this._hass&&(this._initialized=!0,await this._fetchRegistries(),this._updateDevices(),this._render())}async _fetchRegistries(){if(this._hass)try{let e=await this._hass.callWS({type:"config/device_registry/list"});for(let i of e)i.manufacturer==="OpenCode"&&this._deviceRegistry.set(i.id,i);let t=await this._hass.callWS({type:"config/entity_registry/list"});for(let i of t)i.platform==="mqtt"&&this._deviceRegistry.has(i.device_id)&&this._entityRegistry.set(i.entity_id,i)}catch(e){console.error("[opencode-card] Failed to fetch registries:",e)}}_updateDevices(){if(this._hass){this._devices.clear();for(let[e,t]of this._entityRegistry){let i=this._deviceRegistry.get(t.device_id);if(!i)continue;let s=this._hass.states[e];if(!s)continue;let o=this._devices.get(i.id);o||(o={deviceId:i.id,deviceName:i.name,entities:new Map},this._devices.set(i.id,o));let n=t.unique_id||"",a="",c=i.identifiers?.[0]?.[1]||"";if(c&&n.startsWith(c+"_"))a=n.slice(c.length+1);else{let g=["device_id","state","session_title","model","current_tool","tokens_input","tokens_output","cost","last_activity","permission"];for(let d of g)if(n.endsWith("_"+d)){a=d;break}}a&&o.entities.set(a,s)}this._updatePendingPermissions()}}_updatePendingPermissions(){for(let[e,t]of this._devices){let i=t.entities.get("permission"),s=t.entities.get("state"),o=t.entities.get("device_id");if(i?.state==="pending"&&i.attributes){let n=i.attributes;n.permission_id&&n.title&&this._pendingPermissions.set(e,{permission_id:n.permission_id,type:n.type||"unknown",title:n.title,session_id:n.session_id||"",message_id:n.message_id||"",call_id:n.call_id,pattern:n.pattern,metadata:n.metadata,commandTopic:o?.attributes?.command_topic??""})}else if(s?.state!=="waiting_permission"||i?.state==="none")this._pendingPermissions.delete(e);else if(s?.state==="waiting_permission"&&!this._pendingPermissions.has(e)){let n=o?.attributes?.command_topic??"";n&&this._pendingPermissions.set(e,{permission_id:"",type:"pending",title:"Permission Required",session_id:"",message_id:"",commandTopic:n})}}}_getPinnedDevice(){return this._config?.device&&this._devices.get(this._config.device)||null}_getPermissionDetails(e){let t=this._pendingPermissions.get(e.deviceId);if(t&&t.permission_id)return t;let i=e.entities.get("permission"),s=e.entities.get("device_id");if(i?.state!=="pending"||!i.attributes)return t||null;let o=i.attributes;return{permission_id:o.permission_id,type:o.type,title:o.title,session_id:o.session_id,message_id:o.message_id,call_id:o.call_id,pattern:o.pattern,metadata:o.metadata,commandTopic:s?.attributes?.command_topic??""}}_showPermission(e){this._activePermission=e,this._showPermissionModal=!0,this._render()}_hidePermissionModal(){this._showPermissionModal=!1,this._activePermission=null,this._render()}_selectDevice(e){this._selectedDeviceId=e,this._render()}_goBack(){this._selectedDeviceId=null,this._render()}_isPinned(){return!!this._config?.device}_showPrompt(e){this._promptCommandTopic=e,this._showPromptModal=!0,this._render(),setTimeout(()=>{this.querySelector(".prompt-textarea")?.focus()},50)}_hidePromptModal(){this._showPromptModal=!1,this._promptCommandTopic=null,this._render()}async _sendPrompt(e){if(!(!this._hass||!this._promptCommandTopic||!e.trim()))try{await this._hass.callService("mqtt","publish",{topic:this._promptCommandTopic,payload:JSON.stringify({command:"prompt",text:e.trim()})}),this._hidePromptModal()}catch(t){console.error("[opencode-card] Failed to send prompt:",t)}}async _showHistory(e,t,i){this._historyDeviceId=e,this._historyCommandTopic=t,this._historyResponseTopic=i,this._showHistoryView=!0,this._historyLoading=!0,this._render();let s=this._loadHistoryFromCache(e);s?(this._historyData=s.data,this._historyLoading=!1,this._render(),await this._fetchHistorySince(s.lastFetched)):await this._fetchFullHistory()}_hideHistoryView(){this._showHistoryView=!1,this._historyLoading=!1,this._historyData=null,this._historyDeviceId=null,this._historyCommandTopic=null,this._historyResponseTopic=null,this._historyVisibleCount=10,this._historyLoadingMore=!1,this._render()}_loadHistoryFromCache(e){try{let t=localStorage.getItem(q(e));if(t)return JSON.parse(t)}catch(t){console.error("[opencode-card] Failed to load history from cache:",t)}return null}_saveHistoryToCache(e,t){try{let i={data:t,lastFetched:t.fetched_at};localStorage.setItem(q(e),JSON.stringify(i))}catch(i){console.error("[opencode-card] Failed to save history to cache:",i)}}async _fetchFullHistory(){if(!this._hass||!this._historyCommandTopic||!this._historyResponseTopic||!this._historyDeviceId)return;let e=`req_${Date.now()}`;await this._subscribeToResponse(e);try{await this._hass.callService("mqtt","publish",{topic:this._historyCommandTopic,payload:JSON.stringify({command:"get_history",request_id:e})})}catch(t){console.error("[opencode-card] Failed to request history:",t),this._historyLoading=!1,this._render()}}async _fetchHistorySince(e){if(!this._hass||!this._historyCommandTopic||!this._historyResponseTopic||!this._historyDeviceId)return;let t=`req_${Date.now()}`;await this._subscribeToResponse(t);try{await this._hass.callService("mqtt","publish",{topic:this._historyCommandTopic,payload:JSON.stringify({command:"get_history_since",since:e,request_id:t})})}catch(i){console.error("[opencode-card] Failed to request history update:",i)}}async _subscribeToResponse(e){if(!(!this._hass||!this._historyResponseTopic))try{let t=await this._hass.connection.subscribeEvents(i=>{let s=i;if(s.data?.topic===this._historyResponseTopic)try{let o=JSON.parse(s.data.payload||"{}");o.type==="history"&&(!o.request_id||o.request_id===e)&&this._handleHistoryResponse(o)}catch(o){console.error("[opencode-card] Failed to parse history response:",o)}},"mqtt_message_received");this._mqttUnsubscribe=t,setTimeout(()=>{this._mqttUnsubscribe&&(this._mqttUnsubscribe(),this._mqttUnsubscribe=null),this._historyLoading&&(this._historyLoading=!1,this._render())},3e4)}catch(t){console.error("[opencode-card] Failed to subscribe to response topic:",t)}}_handleHistoryResponse(e){if(this._historyDeviceId){if(e.since&&this._historyData){let t=new Set(this._historyData.messages.map(s=>s.id)),i=e.messages.filter(s=>!t.has(s.id));this._historyData.messages.push(...i),this._historyData.fetched_at=e.fetched_at}else this._historyData=e;this._saveHistoryToCache(this._historyDeviceId,this._historyData),this._historyLoading=!1,this._render(),this._mqttUnsubscribe&&(this._mqttUnsubscribe(),this._mqttUnsubscribe=null)}}_refreshHistory(){!this._historyDeviceId||!this._historyData||(this._historyLoading=!0,this._render(),this._fetchHistorySince(this._historyData.fetched_at))}async _respondToPermission(e){if(!this._hass||!this._activePermission)return;let{commandTopic:t,permission_id:i}=this._activePermission;if(!t){console.error("[opencode-card] Cannot respond: missing command topic");return}if(!i){console.error("[opencode-card] Cannot respond: missing permission_id (still loading)");return}try{await this._hass.callService("mqtt","publish",{topic:t,payload:JSON.stringify({command:"permission_response",permission_id:i,response:e})}),this._hidePermissionModal()}catch(s){console.error("[opencode-card] Failed to send permission response:",s)}}_render(){let e=this._config?.title??"OpenCode Sessions",t=this._getPinnedDevice(),i=this._selectedDeviceId?this._devices.get(this._selectedDeviceId):null,s="";t?s=`
        <ha-card>
          <div class="card-content pinned">
            ${this._renderDetailView(t,!1)}
          </div>
        </ha-card>
      `:i?s=`
        <ha-card>
          <div class="card-content pinned">
            ${this._renderDetailView(i,!0)}
          </div>
        </ha-card>
      `:s=`
        <ha-card>
          <div class="card-header">
            <div class="name">${e}</div>
          </div>
          <div class="card-content">
            ${this._devices.size===0?this._renderEmpty():this._renderDevices()}
          </div>
        </ha-card>
      `,this._showPermissionModal&&this._activePermission&&(s+=this._renderPermissionModal(this._activePermission)),this._showPromptModal&&(s+=this._renderPromptModal()),this._showHistoryView&&(s+=this._renderHistoryView()),this.innerHTML=`
      ${s}
      <style>
        ${this._getStyles()}
      </style>
    `,this._attachEventListeners()}_attachEventListeners(){!this._isPinned()&&!this._selectedDeviceId&&this.querySelectorAll(".device-card[data-device-id]").forEach(t=>{t.addEventListener("click",i=>{if(i.target.closest(".permission-alert"))return;let s=t.dataset.deviceId;s&&this._selectDevice(s)})}),this.querySelector(".back-button")?.addEventListener("click",()=>{this._goBack()}),this.querySelectorAll(".permission-alert[data-device-id]").forEach(t=>{t.addEventListener("click",i=>{i.stopPropagation();let s=t.dataset.deviceId;if(s){let o=this._devices.get(s);if(o){let n=this._getPermissionDetails(o);if(n)this._showPermission(n);else{let c=o.entities.get("device_id")?.attributes?.command_topic??"";c&&this._showPermission({permission_id:"",type:"pending",title:"Permission Required",session_id:"",message_id:"",commandTopic:c})}}}})}),this.querySelector(".modal-backdrop:not(.prompt-modal-backdrop):not(.history-modal-backdrop)")?.addEventListener("click",t=>{t.target.classList.contains("modal-backdrop")&&this._hidePermissionModal()}),this.querySelector(".modal-close:not(.prompt-close):not(.history-close)")?.addEventListener("click",()=>{this._hidePermissionModal()}),this.querySelector(".btn-allow-once")?.addEventListener("click",()=>{this._respondToPermission("once")}),this.querySelector(".btn-allow-always")?.addEventListener("click",()=>{this._respondToPermission("always")}),this.querySelector(".btn-reject")?.addEventListener("click",()=>{this._respondToPermission("reject")}),this.querySelector(".send-prompt-btn")?.addEventListener("click",()=>{let t=this.querySelector(".send-prompt-btn")?.dataset.commandTopic;t&&this._showPrompt(t)}),this.querySelector(".prompt-modal-backdrop")?.addEventListener("click",t=>{t.target.classList.contains("prompt-modal-backdrop")&&this._hidePromptModal()}),this.querySelector(".prompt-close")?.addEventListener("click",()=>{this._hidePromptModal()}),this.querySelector(".prompt-cancel")?.addEventListener("click",()=>{this._hidePromptModal()}),this.querySelector(".prompt-send")?.addEventListener("click",()=>{let t=this.querySelector(".prompt-textarea");t?.value&&this._sendPrompt(t.value)}),this.querySelector(".prompt-textarea")?.addEventListener("keydown",t=>{if(t.key==="Enter"&&(t.ctrlKey||t.metaKey)){let i=t.target;i?.value&&this._sendPrompt(i.value)}}),this.querySelector(".view-history-btn")?.addEventListener("click",()=>{let t=this.querySelector(".view-history-btn"),i=t?.dataset.deviceId,s=t?.dataset.commandTopic,o=t?.dataset.responseTopic;i&&s&&o&&this._showHistory(i,s,o)}),this.querySelector(".history-modal-backdrop")?.addEventListener("click",t=>{t.target.classList.contains("history-modal-backdrop")&&this._hideHistoryView()}),this.querySelector(".history-close")?.addEventListener("click",()=>{this._hideHistoryView()}),this.querySelector(".history-refresh-btn")?.addEventListener("click",()=>{this._refreshHistory()}),this.querySelector(".history-load-more")?.addEventListener("click",()=>{this._loadMoreHistory()});let e=this.querySelector(".history-body");e&&e.addEventListener("scroll",()=>{if(e.scrollTop<50&&!this._historyLoadingMore){let t=this._historyData?.messages.length||0;Math.max(0,t-this._historyVisibleCount)>0&&this._loadMoreHistory()}})}_renderPermissionModal(e){let t=!!e.permission_id,i=t?"":"disabled";return`
      <div class="modal-backdrop">
        <div class="modal">
          <div class="modal-header">
            <ha-icon icon="mdi:shield-alert"></ha-icon>
            <span class="modal-title">Permission Required</span>
            <button class="modal-close">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="modal-body">
            <div class="permission-info">
              <div class="permission-main-title">${e.title}</div>
              <div class="permission-type-badge">${e.type}</div>
            </div>
            ${t?"":`
              <div class="permission-section">
                <div class="permission-loading">
                  <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
                  <span>Loading permission details...</span>
                </div>
              </div>
            `}
            ${e.pattern?`
              <div class="permission-section">
                <div class="section-label">Pattern</div>
                <code class="pattern-code">${e.pattern}</code>
              </div>
            `:""}
            ${e.metadata&&Object.keys(e.metadata).length>0?`
              <div class="permission-section">
                <div class="section-label">Details</div>
                <div class="metadata-list">
                  ${Object.entries(e.metadata).map(([s,o])=>`
                    <div class="metadata-item">
                      <span class="metadata-key">${s}:</span>
                      <span class="metadata-value">${typeof o=="object"?JSON.stringify(o):String(o)}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
            `:""}
          </div>
          <div class="modal-actions">
            <button class="btn btn-reject" ${i}>
              <ha-icon icon="mdi:close-circle"></ha-icon>
              Reject
            </button>
            <button class="btn btn-allow-once" ${i}>
              <ha-icon icon="mdi:check"></ha-icon>
              Allow Once
            </button>
            <button class="btn btn-allow-always" ${i}>
              <ha-icon icon="mdi:check-all"></ha-icon>
              Always Allow
            </button>
          </div>
        </div>
      </div>
    `}_renderPromptModal(){return`
      <div class="modal-backdrop prompt-modal-backdrop">
        <div class="modal prompt-modal">
          <div class="modal-header prompt-header">
            <ha-icon icon="mdi:message-text"></ha-icon>
            <span class="modal-title">Send Prompt</span>
            <button class="modal-close prompt-close">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="modal-body">
            <textarea class="prompt-textarea" placeholder="Enter your prompt..." rows="4"></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-cancel prompt-cancel">
              Cancel
            </button>
            <button class="btn btn-send prompt-send">
              <ha-icon icon="mdi:send"></ha-icon>
              Send
            </button>
          </div>
        </div>
      </div>
    `}_renderHistoryView(){let e=this._historyData?.fetched_at?new Date(this._historyData.fetched_at).toLocaleString():"";return`
      <div class="modal-backdrop history-modal-backdrop">
        <div class="modal history-modal">
          <div class="modal-header history-header">
            <ha-icon icon="mdi:history"></ha-icon>
            <span class="modal-title">Session History</span>
            <div class="history-header-actions">
              <button class="history-refresh-btn" ${this._historyLoading?"disabled":""}>
                <ha-icon icon="mdi:refresh" class="${this._historyLoading?"spinning":""}"></ha-icon>
              </button>
              <button class="modal-close history-close">
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          </div>
          <div class="history-subheader">
            <span class="history-title">${this._historyData?.session_title||"Loading..."}</span>
            ${e?`<span class="history-fetched">Last updated: ${e}</span>`:""}
          </div>
          <div class="modal-body history-body">
            ${this._historyLoading&&!this._historyData?this._renderHistoryLoading():""}
            ${this._historyData?this._renderHistoryMessages():""}
          </div>
        </div>
      </div>
    `}_renderHistoryLoading(){return`
      <div class="history-loading">
        <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
        <span>Loading history...</span>
      </div>
    `}_renderHistoryMessages(){if(!this._historyData||this._historyData.messages.length===0)return`
        <div class="history-empty">
          <ha-icon icon="mdi:message-off"></ha-icon>
          <span>No messages in this session</span>
        </div>
      `;let e=this._historyData.messages.length,t=Math.max(0,e-this._historyVisibleCount),i=this._historyData.messages.slice(t),s=t>0,o="";if(s){let n=t;o+=`
        <div class="history-load-more" data-action="load-more">
          <ha-icon icon="${this._historyLoadingMore?"mdi:loading":"mdi:chevron-up"}" class="${this._historyLoadingMore?"spinning":""}"></ha-icon>
          <span>${this._historyLoadingMore?"Loading...":`Load ${Math.min(n,_.HISTORY_PAGE_SIZE)} more (${n} remaining)`}</span>
        </div>
      `}return o+=i.map(n=>this._renderHistoryMessage(n)).join(""),o}_loadMoreHistory(){if(!this._historyData||this._historyLoadingMore)return;let e=this._historyData.messages.length;Math.max(0,e-this._historyVisibleCount)<=0||(this._historyLoadingMore=!0,this._render(),setTimeout(()=>{this._historyVisibleCount+=_.HISTORY_PAGE_SIZE,this._historyLoadingMore=!1;let s=this.querySelector(".history-body")?.scrollHeight||0;this._render();let o=this.querySelector(".history-body");if(o&&s>0){let a=o.scrollHeight-s;o.scrollTop=a}},100))}_renderHistoryMessage(e){let t=e.role==="user",i=new Date(e.timestamp).toLocaleTimeString(),s=e.parts.map(n=>{if(n.type==="text"&&n.content)return`<div class="history-text">${this._escapeHtml(n.content)}</div>`;if(n.type==="tool_call"){let a=n.tool_output||n.tool_error;return`
          <div class="history-tool">
            <div class="tool-header">
              <ha-icon icon="mdi:tools"></ha-icon>
              <span class="tool-name">${n.tool_name||"unknown"}</span>
            </div>
            ${n.tool_args?`<pre class="tool-args">${this._escapeHtml(JSON.stringify(n.tool_args,null,2))}</pre>`:""}
            ${a?`
              <div class="tool-result ${n.tool_error?"error":""}">
                <span class="tool-result-label">${n.tool_error?"Error:":"Output:"}</span>
                <pre class="tool-output">${this._escapeHtml(n.tool_error||n.tool_output||"")}</pre>
              </div>
            `:""}
          </div>
        `}else if(n.type==="image")return`<div class="history-image"><ha-icon icon="mdi:image"></ha-icon> ${n.content||"Image"}</div>`;return""}).join(""),o="";if(!t&&(e.model||e.tokens_input||e.cost)){let n=[];e.model&&n.push(e.model),(e.tokens_input||e.tokens_output)&&n.push(`${e.tokens_input||0}/${e.tokens_output||0} tokens`),e.cost&&n.push(`$${e.cost.toFixed(4)}`),o=`<div class="message-meta">${n.join(" \xB7 ")}</div>`}return`
      <div class="history-message ${t?"user":"assistant"}">
        <div class="message-header">
          <ha-icon icon="${t?"mdi:account":"mdi:robot"}"></ha-icon>
          <span class="message-role">${t?"You":"Assistant"}</span>
          <span class="message-time">${i}</span>
        </div>
        <div class="message-content">
          ${s}
        </div>
        ${o}
      </div>
    `}_escapeHtml(e){let t=document.createElement("div");return t.textContent=e,t.innerHTML}_renderEmpty(){return`
      <div class="empty-state">
        <ha-icon icon="mdi:code-braces-box"></ha-icon>
        <p>No OpenCode sessions found</p>
      </div>
    `}_renderDevices(){let e=[];for(let[,t]of this._devices)e.push(this._renderDevice(t));return e.join("")}_renderDetailView(e,t){let i=e.entities.get("state"),s=e.entities.get("session_title"),o=e.entities.get("model"),n=e.entities.get("current_tool"),a=e.entities.get("device_id"),c=e.entities.get("cost"),g=e.entities.get("tokens_input"),d=e.entities.get("tokens_output"),l=e.entities.get("last_activity"),v=i?.state??"unknown",p=E[v]||E.unknown,u=s?.state??"Unknown Session",M=o?.state??"unknown",x=n?.state??"none",f=a?.attributes?.command_topic??"unknown",H=a?.attributes?.response_topic??"",w=c?.state??"0",y=g?.state??"0",b=d?.state??"0",k=l?.state??"",P=i?.attributes?.agent||null,D=i?.attributes?.current_agent||null,C=i?.attributes?.hostname||null,z="";k&&(z=new Date(k).toLocaleTimeString());let $=this._getPermissionDetails(e),S="";if($){let I=!!$.permission_id;S=`
        <div class="permission-alert pinned clickable" data-device-id="${e.deviceId}">
          <ha-icon icon="mdi:shield-alert"></ha-icon>
          <div class="permission-details">
            <div class="permission-title">${$.title}</div>
            <div class="permission-type">${$.type}${I?"":" (loading...)"}</div>
          </div>
          <ha-icon icon="mdi:chevron-right" class="permission-chevron"></ha-icon>
        </div>
      `}else v==="waiting_permission"&&(S=`
        <div class="permission-alert pinned clickable" data-device-id="${e.deviceId}">
          <ha-icon icon="mdi:shield-alert"></ha-icon>
          <div class="permission-details">
            <div class="permission-title">Permission Required</div>
            <div class="permission-type">Tap to view details</div>
          </div>
          <ha-icon icon="mdi:chevron-right" class="permission-chevron"></ha-icon>
        </div>
      `);return`
      <div class="detail-view">
        ${t?`
      <button class="back-button" data-action="back">
        <ha-icon icon="mdi:arrow-left"></ha-icon>
        <span>Back</span>
      </button>
    `:""}
        <div class="detail-header">
          <div class="detail-status ${v==="working"?"pulse":""}" style="background: ${p.color}20; border-color: ${p.color}">
            <ha-icon icon="${p.icon}" style="color: ${p.color}"></ha-icon>
            <span class="status-text" style="color: ${p.color}">${p.label}</span>
          </div>
          <div class="detail-project-info">
            <div class="detail-project">${e.deviceName.replace("OpenCode - ","")}</div>
            ${C?`<div class="detail-hostname"><ha-icon icon="mdi:server"></ha-icon> ${C}</div>`:""}
          </div>
        </div>

        <div class="detail-session">
          <ha-icon icon="mdi:message-text"></ha-icon>
          <span class="session-title">${u}</span>
        </div>

        ${S}

        <div class="detail-info">
          <div class="detail-row">
            <ha-icon icon="mdi:brain"></ha-icon>
            <span class="detail-label">Model</span>
            <span class="detail-value mono">${M}</span>
          </div>
          ${P?`
          <div class="detail-row">
            <ha-icon icon="mdi:account-cog"></ha-icon>
            <span class="detail-label">Agent</span>
            <span class="detail-value agent-badge">${P}${D&&D!==P?` <span class="sub-agent-indicator"><ha-icon icon="mdi:arrow-right"></ha-icon> ${D}</span>`:""}</span>
          </div>
          `:""}
          ${x!=="none"?`
          <div class="detail-row highlight">
            <ha-icon icon="mdi:tools"></ha-icon>
            <span class="detail-label">Tool</span>
            <span class="detail-value mono tool-active">${x}</span>
          </div>
          `:""}
          <div class="detail-row">
            <ha-icon icon="mdi:clock-outline"></ha-icon>
            <span class="detail-label">Last Activity</span>
            <span class="detail-value">${z||"\u2014"}</span>
          </div>
        </div>

        <div class="detail-stats">
          <div class="stat">
            <ha-icon icon="mdi:currency-usd"></ha-icon>
            <span class="stat-value">$${parseFloat(w).toFixed(4)}</span>
            <span class="stat-label">Cost</span>
          </div>
          <div class="stat">
            <ha-icon icon="mdi:arrow-right-bold"></ha-icon>
            <span class="stat-value">${Number(y).toLocaleString()}</span>
            <span class="stat-label">In</span>
          </div>
          <div class="stat">
            <ha-icon icon="mdi:arrow-left-bold"></ha-icon>
            <span class="stat-value">${Number(b).toLocaleString()}</span>
            <span class="stat-label">Out</span>
          </div>
        </div>

        <div class="detail-actions">
          <button class="send-prompt-btn" data-command-topic="${f}">
            <ha-icon icon="mdi:message-plus"></ha-icon>
            <span>Send Prompt</span>
          </button>
          <button class="view-history-btn" data-device-id="${e.deviceId}" data-command-topic="${f}" data-response-topic="${H}">
            <ha-icon icon="mdi:history"></ha-icon>
            <span>View History</span>
          </button>
        </div>

        <div class="detail-footer">
          <code class="command-topic">${f}</code>
        </div>
      </div>
    `}_renderDevice(e){let t=e.entities.get("state"),i=e.entities.get("session_title"),s=e.entities.get("model"),o=e.entities.get("current_tool"),n=e.entities.get("device_id"),a=e.entities.get("cost"),c=e.entities.get("tokens_input"),g=e.entities.get("tokens_output"),d=t?.state??"unknown",l=E[d]||E.unknown,v=i?.state??"Unknown Session",p=s?.state??"unknown",u=o?.state??"none",M=n?.attributes?.command_topic??"unknown",x=a?.state??"0",f=c?.state??"0",H=g?.state??"0",w=t?.attributes?.current_agent||null,y=this._getPermissionDetails(e),b="";if(y){let k=!!y.permission_id;b=`
        <div class="permission-alert clickable" data-device-id="${e.deviceId}">
          <ha-icon icon="mdi:shield-alert"></ha-icon>
          <div class="permission-details">
            <div class="permission-title">${y.title}</div>
            <div class="permission-type">${y.type}${k?"":" (loading...)"}</div>
          </div>
          <ha-icon icon="mdi:chevron-right" class="permission-chevron"></ha-icon>
        </div>
      `}else d==="waiting_permission"&&(b=`
        <div class="permission-alert clickable" data-device-id="${e.deviceId}">
          <ha-icon icon="mdi:shield-alert"></ha-icon>
          <div class="permission-details">
            <div class="permission-title">Permission Required</div>
            <div class="permission-type">Tap to view details</div>
          </div>
          <ha-icon icon="mdi:chevron-right" class="permission-chevron"></ha-icon>
        </div>
      `);return`
      <div class="device-card clickable" data-device-id="${e.deviceId}">
        <div class="device-header">
          <div class="device-status ${d==="working"?"pulse":""}">
            <ha-icon icon="${l.icon}" style="color: ${l.color}"></ha-icon>
            <span class="status-label" style="color: ${l.color}">${l.label}</span>
          </div>
          <div class="device-name">${e.deviceName.replace("OpenCode - ","")}</div>
          <ha-icon icon="mdi:chevron-right" class="device-chevron"></ha-icon>
        </div>
        
        <div class="device-info">
          <div class="info-row">
            <ha-icon icon="mdi:message-text"></ha-icon>
            <span class="info-label">Session:</span>
            <span class="info-value">${v}</span>
          </div>
          <div class="info-row">
            <ha-icon icon="mdi:brain"></ha-icon>
            <span class="info-label">Model:</span>
            <span class="info-value model">${p}</span>
          </div>
          ${u!=="none"?`
          <div class="info-row">
            <ha-icon icon="mdi:tools"></ha-icon>
            <span class="info-label">Tool:</span>
            <span class="info-value tool">${u}</span>
          </div>
          `:""}
          ${w?`
          <div class="info-row">
            <ha-icon icon="mdi:account-switch"></ha-icon>
            <span class="info-label">Sub-agent:</span>
            <span class="info-value sub-agent">${w}</span>
          </div>
          `:""}
          <div class="info-row stats">
            <ha-icon icon="mdi:currency-usd"></ha-icon>
            <span class="stat-value">$${parseFloat(x).toFixed(4)}</span>
            <ha-icon icon="mdi:arrow-right-bold"></ha-icon>
            <span class="stat-value">${f}</span>
            <ha-icon icon="mdi:arrow-left-bold"></ha-icon>
            <span class="stat-value">${H}</span>
          </div>
        </div>

        ${b}
      </div>
    `}_getStyles(){return`
      ha-card {
        padding: 0;
        position: relative;
      }
      .card-header {
        padding: 16px 16px 0;
      }
      .card-header .name {
        font-size: 1.2em;
        font-weight: 500;
      }
      .card-content {
        padding: 16px;
      }
      .card-content.pinned {
        padding: 0;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }
      .empty-state ha-icon {
        --mdc-icon-size: 48px;
        margin-bottom: 16px;
      }

      /* Pulse animation for working state */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .pulse {
        animation: pulse 2s ease-in-out infinite;
      }
      .pulse ha-icon {
        animation: pulse 1s ease-in-out infinite;
      }

      /* List view styles */
      .device-card {
        background: var(--card-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
      }
      .device-card.clickable {
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s, transform 0.1s;
      }
      .device-card.clickable:hover {
        background: var(--secondary-background-color);
        border-color: var(--primary-color);
      }
      .device-card.clickable:active {
        transform: scale(0.99);
      }
      .device-card:last-child {
        margin-bottom: 0;
      }
      .device-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--divider-color);
      }
      .device-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .device-status ha-icon {
        --mdc-icon-size: 24px;
      }
      .status-label {
        font-weight: 500;
        text-transform: uppercase;
        font-size: 0.85em;
      }
      .device-name {
        flex: 1;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .device-chevron {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
      .device-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .info-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
      }
      .info-row ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
      }
      .info-label {
        color: var(--secondary-text-color);
        min-width: 60px;
      }
      .info-value {
        color: var(--primary-text-color);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .info-value.model {
        font-family: monospace;
        font-size: 0.85em;
      }
      .info-value.tool {
        font-family: monospace;
        color: var(--info-color, #2196f3);
      }
      .info-value.sub-agent {
        font-weight: 500;
        color: var(--accent-color, #673ab7);
      }
      .info-row.stats {
        margin-top: 4px;
        gap: 12px;
      }
      .stat-value {
        font-family: monospace;
        font-size: 0.85em;
        color: var(--secondary-text-color);
      }
      .device-footer {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--divider-color);
      }

      /* Detail view styles */
      .detail-view {
        padding: 16px;
      }
      .back-button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin-bottom: 16px;
        background: var(--secondary-background-color);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: var(--primary-text-color);
        font-size: 0.9em;
        transition: background 0.2s;
      }
      .back-button:hover {
        background: var(--divider-color);
      }
      .back-button ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
      }
      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .detail-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 24px;
        border: 1px solid;
      }
      .detail-status ha-icon {
        --mdc-icon-size: 20px;
      }
      .status-text {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.8em;
        letter-spacing: 0.5px;
      }
      .detail-project-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .detail-project {
        font-weight: 500;
        font-size: 1.1em;
        color: var(--primary-text-color);
      }
      .detail-hostname {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75em;
        color: var(--secondary-text-color);
      }
      .detail-hostname ha-icon {
        --mdc-icon-size: 12px;
      }
      .detail-session {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--secondary-background-color);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .detail-session ha-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
      .session-title {
        font-size: 1em;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .detail-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      .detail-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .detail-row ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
      }
      .detail-label {
        color: var(--secondary-text-color);
        min-width: 100px;
        font-size: 0.9em;
      }
      .detail-value {
        flex: 1;
        color: var(--primary-text-color);
      }
      .detail-value.mono {
        font-family: monospace;
        font-size: 0.9em;
      }
      .detail-value.tool-active {
        color: var(--info-color, #2196f3);
        font-weight: 500;
      }
      .detail-value.agent-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .sub-agent-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        background: var(--accent-color, #673ab7);
        color: white;
        border-radius: 12px;
        font-size: 0.85em;
        font-weight: 500;
      }
      .sub-agent-indicator ha-icon {
        --mdc-icon-size: 14px;
      }
      .detail-row.highlight {
        background: var(--info-color, #2196f3);
        background: rgba(33, 150, 243, 0.1);
        margin: 0 -16px;
        padding: 8px 16px;
        border-radius: 8px;
      }
      .detail-stats {
        display: flex;
        justify-content: space-around;
        padding: 16px;
        background: var(--secondary-background-color);
        border-radius: 8px;
        margin-bottom: 16px;
      }
      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .stat ha-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
      .stat .stat-value {
        font-size: 1.1em;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .stat .stat-label {
        font-size: 0.75em;
        color: var(--secondary-text-color);
        text-transform: uppercase;
      }
      .detail-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .send-prompt-btn, .view-history-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex: 1;
        padding: 12px 16px;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1em;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .send-prompt-btn {
        background: var(--primary-color, #03a9f4);
      }
      .send-prompt-btn:hover {
        background: #0288d1;
      }
      .view-history-btn {
        background: var(--secondary-text-color, #666);
      }
      .view-history-btn:hover {
        background: #555;
      }
      .send-prompt-btn:active, .view-history-btn:active {
        transform: scale(0.98);
      }
      .send-prompt-btn ha-icon, .view-history-btn ha-icon {
        --mdc-icon-size: 20px;
      }
      .detail-footer {
        padding-top: 12px;
        border-top: 1px solid var(--divider-color);
      }

      /* Permission alert styles */
      .permission-alert {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 12px;
        padding: 12px;
        background: rgba(255, 152, 0, 0.15);
        border: 1px solid var(--warning-color, #ff9800);
        border-radius: 8px;
      }
      .permission-alert.clickable {
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .permission-alert.clickable:hover {
        background: rgba(255, 152, 0, 0.25);
      }
      .permission-alert.clickable:active {
        transform: scale(0.98);
      }
      .permission-alert.pinned {
        margin: 0 0 16px 0;
        padding: 16px;
      }
      .permission-alert ha-icon {
        --mdc-icon-size: 24px;
        color: var(--warning-color, #ff9800);
      }
      .permission-details {
        flex: 1;
      }
      .permission-title {
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .permission-type {
        font-size: 0.85em;
        color: var(--secondary-text-color);
      }
      .permission-chevron {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }

      .command-topic {
        display: block;
        font-size: 0.75em;
        color: var(--secondary-text-color);
        background: var(--secondary-background-color);
        padding: 4px 8px;
        border-radius: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Modal styles */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
        padding: 16px;
      }
      .modal {
        background: var(--card-background-color);
        border-radius: 16px;
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      }
      .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--divider-color);
        background: rgba(255, 152, 0, 0.1);
      }
      .modal-header ha-icon {
        --mdc-icon-size: 28px;
        color: var(--warning-color, #ff9800);
      }
      .modal-title {
        flex: 1;
        font-size: 1.2em;
        font-weight: 600;
        color: var(--primary-text-color);
      }
      .modal-close {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-close:hover {
        background: var(--secondary-background-color);
      }
      .modal-close ha-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
      .modal-body {
        padding: 20px;
        overflow-y: auto;
      }
      .permission-info {
        margin-bottom: 20px;
      }
      .permission-main-title {
        font-size: 1.1em;
        font-weight: 500;
        color: var(--primary-text-color);
        margin-bottom: 8px;
      }
      .permission-type-badge {
        display: inline-block;
        padding: 4px 12px;
        background: var(--warning-color, #ff9800);
        color: white;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 500;
        text-transform: uppercase;
      }
      .permission-section {
        margin-bottom: 16px;
      }
      .permission-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: rgba(255, 152, 0, 0.1);
        border-radius: 8px;
        color: var(--secondary-text-color);
      }
      .permission-loading ha-icon {
        --mdc-icon-size: 20px;
        color: var(--warning-color, #ff9800);
      }
      .section-label {
        font-size: 0.85em;
        font-weight: 500;
        color: var(--secondary-text-color);
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .pattern-code {
        display: block;
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 8px;
        font-size: 0.9em;
        word-break: break-all;
        color: var(--primary-text-color);
      }
      .metadata-list {
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 12px;
      }
      .metadata-item {
        display: flex;
        gap: 8px;
        padding: 4px 0;
        font-size: 0.9em;
      }
      .metadata-key {
        color: var(--secondary-text-color);
        font-weight: 500;
      }
      .metadata-value {
        color: var(--primary-text-color);
        word-break: break-all;
      }
      .modal-actions {
        display: flex;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid var(--divider-color);
        background: var(--secondary-background-color);
      }
      .btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
      }
      .btn:active {
        transform: scale(0.97);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .btn:disabled:hover {
        background: inherit;
      }
      .btn ha-icon {
        --mdc-icon-size: 18px;
      }
      .btn-reject {
        background: var(--error-color, #f44336);
        color: white;
      }
      .btn-reject:hover {
        background: #d32f2f;
      }
      .btn-allow-once {
        background: var(--primary-color, #03a9f4);
        color: white;
      }
      .btn-allow-once:hover {
        background: #0288d1;
      }
      .btn-allow-always {
        background: var(--success-color, #4caf50);
        color: white;
      }
      .btn-allow-always:hover {
        background: #388e3c;
      }

      /* Prompt modal styles */
      .prompt-header {
        background: rgba(3, 169, 244, 0.1);
      }
      .prompt-header ha-icon {
        color: var(--primary-color, #03a9f4);
      }
      .prompt-textarea {
        width: 100%;
        min-height: 120px;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 1em;
        font-family: inherit;
        resize: vertical;
        box-sizing: border-box;
      }
      .prompt-textarea:focus {
        outline: none;
        border-color: var(--primary-color);
      }
      .prompt-textarea::placeholder {
        color: var(--secondary-text-color);
      }
      .btn-cancel {
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }
      .btn-cancel:hover {
        background: var(--divider-color);
      }
      .btn-send {
        background: var(--primary-color, #03a9f4);
        color: white;
      }
      .btn-send:hover {
        background: #0288d1;
      }

      /* History modal styles */
      .history-modal {
        max-width: 600px;
        max-height: 85vh;
      }
      .history-header {
        background: rgba(103, 58, 183, 0.1);
      }
      .history-header ha-icon {
        color: var(--info-color, #673ab7);
      }
      .history-header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .history-refresh-btn {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .history-refresh-btn:hover:not(:disabled) {
        background: var(--secondary-background-color);
      }
      .history-refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .history-refresh-btn ha-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
      .history-subheader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        background: var(--secondary-background-color);
        border-bottom: 1px solid var(--divider-color);
        font-size: 0.9em;
      }
      .history-title {
        font-weight: 500;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .history-fetched {
        color: var(--secondary-text-color);
        font-size: 0.85em;
        margin-left: 12px;
      }
      .history-body {
        padding: 16px 20px;
        overflow-y: auto;
        max-height: calc(85vh - 140px);
      }
      .history-loading, .history-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--secondary-text-color);
        gap: 12px;
      }
      .history-loading ha-icon, .history-empty ha-icon {
        --mdc-icon-size: 36px;
      }

      /* Spinning animation */
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spinning {
        animation: spin 1s linear infinite;
      }

      /* Load more history button */
      .history-load-more {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        margin-bottom: 16px;
        background: var(--secondary-background-color);
        border: 1px dashed var(--divider-color);
        border-radius: 8px;
        cursor: pointer;
        color: var(--secondary-text-color);
        font-size: 0.9em;
        transition: background 0.2s, border-color 0.2s;
      }
      .history-load-more:hover {
        background: var(--divider-color);
        border-color: var(--primary-color);
        color: var(--primary-text-color);
      }
      .history-load-more ha-icon {
        --mdc-icon-size: 18px;
      }

      /* History message styles */
      .history-message {
        margin-bottom: 16px;
        padding: 12px;
        border-radius: 12px;
        background: var(--secondary-background-color);
      }
      .history-message:last-child {
        margin-bottom: 0;
      }
      .history-message.user {
        background: rgba(3, 169, 244, 0.1);
        border: 1px solid rgba(3, 169, 244, 0.2);
      }
      .history-message.assistant {
        background: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
      }
      .message-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color);
      }
      .message-header ha-icon {
        --mdc-icon-size: 18px;
      }
      .history-message.user .message-header ha-icon {
        color: var(--primary-color, #03a9f4);
      }
      .history-message.assistant .message-header ha-icon {
        color: var(--success-color, #4caf50);
      }
      .message-role {
        font-weight: 500;
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .message-time {
        margin-left: auto;
        font-size: 0.8em;
        color: var(--secondary-text-color);
      }
      .message-content {
        color: var(--primary-text-color);
        font-size: 0.95em;
        line-height: 1.5;
      }
      .message-meta {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--divider-color);
        font-size: 0.75em;
        color: var(--secondary-text-color);
        font-family: monospace;
      }

      /* History text content */
      .history-text {
        white-space: pre-wrap;
        word-break: break-word;
        margin-bottom: 8px;
      }
      .history-text:last-child {
        margin-bottom: 0;
      }

      /* History tool call styles */
      .history-tool {
        margin: 8px 0;
        padding: 12px;
        background: var(--card-background-color);
        border-radius: 8px;
        border: 1px solid var(--divider-color);
      }
      .history-tool:last-child {
        margin-bottom: 0;
      }
      .tool-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .tool-header ha-icon {
        --mdc-icon-size: 16px;
        color: var(--info-color, #2196f3);
      }
      .tool-name {
        font-weight: 500;
        font-size: 0.9em;
        color: var(--info-color, #2196f3);
        font-family: monospace;
      }
      .tool-args {
        margin: 8px 0;
        padding: 8px 12px;
        background: var(--secondary-background-color);
        border-radius: 6px;
        font-size: 0.8em;
        overflow-x: auto;
        white-space: pre;
        max-height: 150px;
        overflow-y: auto;
      }
      .tool-result {
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(76, 175, 80, 0.1);
        border-radius: 6px;
        border-left: 3px solid var(--success-color, #4caf50);
      }
      .tool-result.error {
        background: rgba(244, 67, 54, 0.1);
        border-left-color: var(--error-color, #f44336);
      }
      .tool-result-label {
        display: block;
        font-size: 0.8em;
        font-weight: 500;
        margin-bottom: 4px;
        color: var(--secondary-text-color);
      }
      .tool-output {
        margin: 0;
        font-size: 0.8em;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 200px;
        overflow-y: auto;
      }

      /* History image placeholder */
      .history-image {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--secondary-background-color);
        border-radius: 6px;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }
      .history-image ha-icon {
        --mdc-icon-size: 18px;
      }
    `}static getConfigElement(){return document.createElement("opencode-card-editor")}static getStubConfig(){return{title:"OpenCode Sessions"}}};r(_,"HISTORY_PAGE_SIZE",10);var T=_,L=class extends HTMLElement{constructor(){super(...arguments);r(this,"_config");r(this,"_hass");r(this,"_devices",[])}set hass(e){this._hass=e,this._fetchDevices()}setConfig(e){this._config=e,this._render()}async _fetchDevices(){if(this._hass)try{let e=await this._hass.callWS({type:"config/device_registry/list"});this._devices=e.filter(t=>t.manufacturer==="OpenCode"),this._render()}catch(e){console.error("[opencode-card-editor] Failed to fetch devices:",e)}}_render(){let e=this._config?.device??"",t=this._config?.title??"";this.innerHTML=`
      <div class="editor">
        <div class="field">
          <label for="title">Title</label>
          <input type="text" id="title" value="${t}" placeholder="OpenCode Sessions">
          <div class="hint">Leave empty to use default title. Hidden when device is selected.</div>
        </div>
        <div class="field">
          <label for="device">Pin to Device</label>
          <select id="device">
            <option value="">Show all devices</option>
            ${this._devices.map(o=>`
              <option value="${o.id}" ${o.id===e?"selected":""}>
                ${o.name}
              </option>
            `).join("")}
          </select>
          <div class="hint">Select a device to show detailed view for that device only.</div>
        </div>
      </div>
      <style>
        .editor {
          padding: 16px;
        }
        .field {
          margin-bottom: 16px;
        }
        .field:last-child {
          margin-bottom: 0;
        }
        label {
          display: block;
          font-weight: 500;
          margin-bottom: 8px;
          color: var(--primary-text-color);
        }
        input, select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 1em;
          box-sizing: border-box;
        }
        input:focus, select:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        .hint {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
      </style>
    `;let i=this.querySelector("#title"),s=this.querySelector("#device");i?.addEventListener("input",o=>this._valueChanged("title",o.target.value)),s?.addEventListener("change",o=>this._valueChanged("device",o.target.value))}_valueChanged(e,t){let i={...this._config,[e]:t||void 0};i.title||delete i.title,i.device||delete i.device;let s=new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0});this.dispatchEvent(s)}};customElements.define("opencode-card",T);customElements.define("opencode-card-editor",L);window.customCards=window.customCards||[];window.customCards.push({type:"opencode-card",name:"OpenCode Card",description:"Display OpenCode sessions and their states"});console.info("%c OPENCODE-CARD %c 0.1.0 ","color: white; background: #2196f3; font-weight: bold;","color: #2196f3; background: white; font-weight: bold;");
