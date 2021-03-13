// import injectFunction from './my-script.js';
// injectFunction();
// content-script和页面内的脚本（injected-script自然也属于页面内的脚本）
// 之间唯一共享的东西就是页面的DOM元素，有2种方法可以实现二者通讯：
// 可以通过window.postMessage和window.addEventListener来实现二者消息通讯；
// 通过自定义DOM事件来实现；

'use strict';

const MY_TUOTIAO_NAME = '程序员LIYI'
const SLEEP_FACTOR = 1.1 // 休息时间因子

// 向页面插入一个es6模块
function injectJavaScriptModule(jsPath) {
    const p = new Promise(
        async resolve => {
            // 是为防止缓存不加载
            jsPath += `?${new Date().getTime()}`
            const script = document.createElement('script');
            script.setAttribute("type", "module");
            script.setAttribute("src", chrome.extension.getURL(jsPath));
            script.onload = function (e) {
                // this.parentNode.removeChild(this);
                resolve(window)
            };
            const head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
            head.insertBefore(script, head.lastChild);
        })
    return p
}

// 在这里定义的公众函数，在所有注入脚本里，都可以访问
// 有时候可以访问到，有时候又不可以，为什么？有时候是受其它错误脚本的影响
function sleep(ms) {
    let p = new Promise(
        (resolve) => {
            console.log("sellep", ms);
            setTimeout(resolve, ms)
        });
    return p
}

// ++++++++++++++++++++++++++++++

// 这个页面貌似没有什么用
// 这当作是一个共享的页面

// const script = document.createElement('script');
// script.setAttribute("type", "module");
// script.setAttribute("src", chrome.extension.getURL('main.js'));
// const head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
// head.insertBefore(script, head.lastChild);

const GLOBAL_COMMENTS_ARRAY = [
    "支持你，送你上青云"
    , "评了赞了，加油"
    , "收藏了，加油"
    , "收藏了，为你增加活跃"
    , "收藏了，为你增加人气",
    , "我是你的粉丝，加油"
    , "喜欢你的内容，加油"
    , "为你增加人气，送你上青云"
    , "夜空少了一颗星，那是文曲星"
    , "手动点赞，送你上青云"
    , "喜欢你的内容，为你增加活跃"
    , "喜欢你的创作，加油"
    , "我是你的粉丝，支持你"
    , "关注你了，加油"
    , "飞机上挂暖壶————高水平"
]
// 这个配置要存储到storage中，而不是内存中
// 有时候这个配置为什么写不进去，写错了？
const yyconfig = {
    maxNumArticleAndWetoutiaoToDealWith: 5 //最多给每个用户文章、微关条点赞多少次
    ,maxNumWukongAnswersToDealWith: 5 //最多给每个用户悟空问答点赞多少次
    ,requireFollowUser: true // 默认情况下，在用户主页如果未关注，需要主动关注，但有时候限额用完了没办法关注
    ,oneComment: '投以木桃，报以琼瑶'//
    ,useOneComment: false //默认不使用一条固定评论
}
// 功能调用之前，修改配置
function setConfig(options){
    // console.log("options",options);
    let yyconfigStoraged = JSON.parse(localStorage.getItem('yyconfig') || JSON.stringify(yyconfig))
    // console.log("yyconfigStoraged",yyconfigStoraged);
    let newConfig = Object.assign(yyconfigStoraged, options)
    localStorage.setItem('yyconfig', JSON.stringify(newConfig));
    window.yyconfig = newConfig
    console.log("newConfig",newConfig);
    return newConfig
}
function clearConfig(){
    localStorage.clear()
    setConfig({})
}
clearConfig({})

// =================

function testQueryAvatarLink(){
    let avatarLink = document.querySelector("a.user-card-avatar")
    if (avatarLink) alert(avatarLink.href)
    return avatarLink.href
}

// 向页面注入JS
// 必须先写在manifest.json/web_accessible_resources内
function injectJavaScriptFile(jsPath) {
    // jsPath = jsPath || 'js/inject.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.setAttribute('defer', 'defer');
    // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
    // let jsPath = `chrome-extension://ohalocmgefnhpgabnnifegjeglfonepj/${jsPath}`
    console.log('file',jsPath);
    temp.src = chrome.extension.getURL(jsPath);
    temp.onload = function () {
        // 放在页面不好看，执行完后移除掉
        // this.parentNode.removeChild(this);
    };
    document.head.appendChild(temp);
}

// ,"js/chrome-extension-async.js"
		// ,"js/execute-async-function.js"

// injectJavaScriptFile('js/main.js')
// injectJavaScriptFile('js/chrome-extension-async.js')
// injectJavaScriptFile('js/execute-async-function.js')

// 从content-script发消息向background
// 能发、能收到
function sendMessageToBackgroundFromContentScript(message) {
    const p = new Promise(
        async resolve => {
            chrome.runtime.sendMessage(message, function(response){
                resolve(response)
            });
        })
    return p
}

function startScrollUp(){
    window._scrollTupInterval = setInterval(() => {
        window.scrollBy(0, 2000)
    }, 1000);
}
function endScrollUp(){
    clearInterval(window._scrollTupInterval)
}

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    let result = 'ok'
    let {cmd, options} = request
    // console.log(sender.tab ?"from a content script:" + sender.tab.url :"from the extension");
    // if (request.cmd == 'test') {//from popup
    //     // alert(window.injectFunction + request.value);
    //     // window.injectFunction()
    //     let response = await sendMessageToBackgroundFromContentScript({ greeting: '你好，我是content-script呀，我主动发消息给后台！' });
    //     console.log('cs收到来自bg的回复：' + response);
    //     alert(window.injectFunction + request.value);
    // }
    // if (request.cmd == 'testfrombg') {//
    //     // sendMessageToBackgroundFromContentScript({greeting: '你好，我是content-script呀，我主动发消息给后台！'}, function(response) {
    //     //     console.log('收到来自后台的回复：' + response);
    //     // });
    // }
    // sendResponse('我收到了你的消息！from cs');
    switch(cmd){
        case 'setConfig':{
            result = setConfig(options)
            break
        }
        case 'getConfig':{
            result = window.yyconfig
            break
        }
        case 'resetConfig':{
            clearConfig({})
            result = window.yyconfig
            break
        }
        case 'toolset':{
            let opt = options.opt 
            switch(opt){
                case "opt_clear_storage":{
                    clearConfig()
                    break
                }
                case "opt_scrolltop_start":{
                    startScrollUp()
                    break
                }
                case "opt_scrolltop_end":{
                    endScrollUp()
                    break
                }
                default:
                    //
            }
            // sendResponse(result);
            break
        }
        default:
            //
    }
    
});


document.addEventListener('DOMContentLoaded', function () {
    // no ouput
    // DOMContentLoaded被执行了！在async执行的时候，执行了，说明这个文件的代码被注入了
    console.log('DOMContentLoaded被执行了！');
});


function triggerClick(el) {
    if (el.click) {
        el.click();
    } else {
        try {
            var evt = document.createEvent('Event');
            evt.initEvent('click', true, true);
            el.dispatchEvent(evt);
        } catch (e) { console.log("triggerClick", el, e) };
    }
}
