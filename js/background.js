/**
 * bg是在每个页面中都默认加载的
 * __tuotiao module是在特定的操作中才加载的，按需加载的
 * __service也是默认加载的
 * cs 是每页默认加载的
 * 
 * 
 * 
 * 速度 554 从0点至上午9:24:03 一个粉丝大约1分钟
 * 
 * Content script是在一个特殊环境中运行的，这个环境成为isolated world（隔离环境）。
 * 它们可以访问所注入页面的DOM,但是不能访问里面的任何javascript变量和函数。 
 * 对每个content script来说，就像除了它自己之外再没有其它脚本在运行。 
 * 反过来也是成立的： 页面里的javascript也不能访问content script中的任何变量和函数。
 * 通过这种方式chrome.tabs.executeAsyncFunction执行的函数，都是content script代码
 * 
 * 将content script写在一个单独立的文件中，引入进来调用，可以吗？
 */
import service from './service.js'
import toutiao from './toutiao.js'

// 屏蔽错误
window.onerror = function () { return true; }

const SLEEP_FACTOR = 1.0 // 休息时间因子
const MY_HOME_URL = `https://www.toutiao.com/c/user/relation/6879705375/?tab=followed`

// 获取当前容器的tab id
async function getCurrentActiveTabId() {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] ? tabs[0].id : null
}
// 打一个新tab，无焦点，并返回id
async function createAndReturnNewTabId(url) {
    const { tabId: newTabId } = await chrome.tabs.createAndWait({ url, active: false })
    return newTabId
}

async function sleep(ms) {
    let p = new Promise(
        (resolve) => {
            console.log("sellep", ms);
            setTimeout(resolve, ms)
        });
    return p
}


// // 包裹cs脚本，先行注入通用脚本于这个作用域中
// function csWrapper(func){
//     // let f = func.bind(null)
//     return function(f){
//         // let args = arguments
//         function sleep(ms) {
//             const p = new Promise(
//                 resolve => {
//                     console.log("sellep", ms);
//                     setTimeout(resolve, ms)
//                 })
//             return p
//         }
//         return f.bind('', ...arguments)
//     }(func)
// }

// =++++++++++++++++++++++++++++++++++++

/**
 * 每天定时执行
 * 参数的说明
oneDayExecutFunc({
    interval: 1, //间隔天数，间隔为整数
    runNow: true, //是否立即运行
    time: "00:00:00" //24h,执行的时间点 时在0~23之间
})
 */
function oneDayExecutFunc(config, func) {
    config.runNow && func()
    let nowTime = new Date().getTime()
    let timePoints = config.time.split(':').map(i => parseInt(i))
    // 语法是 Date.setHours(hour,min,sec,millisec)
    // ...timePoints 是 hour,min,sec
    let recent = new Date().setHours(...timePoints)
    recent >= nowTime || (recent += 24 * 3600000)
    setTimeout(() => {
        func()
        setInterval(func, config.interval * 3600000)
    }, recent - nowTime)
}


function injectJavaScriptFile(jsPath) {
    // jsPath = jsPath || 'js/inject.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
    temp.src = chrome.extension.getURL(jsPath);
    temp.onload = function () {
        // 放在页面不好看，执行完后移除掉
        this.parentNode.removeChild(this);
    };
    document.head.appendChild(temp);
}

// injectJavaScriptFile('js/main.js')
// injectJavaScriptFile('js/chrome-extension-async.js')
// injectJavaScriptFile('js/execute-async-function.js')

// 从bg向contentscript发消息，能发能收到消息
async function sendMessageToContentScriptFromBackground(cmd, options) {
    const p = new Promise(
        async resolve => {
            let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            // 这个sendMessage用不了await
            // 为什么有时候tabs[0]是空的
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { cmd, options }, function (response) {
                resolve(response)
            })
        })
    return p
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    // console.log("request msg", msg);
    let cmd = msg.cmd
    let options = msg.options

    switch (cmd) {
        // 关注我的粉丝并存到库中
        case 'followMyFansAndSaveToDB': {
            followMyFansAndSaveToDB()
            break
        }
        case 'getUserTuotiaoArticleLinksResult': {
            var links = msg.links;
            console.log("links", links)
            break
        }
        // 从库中拉取用户，关注之
        case 'toutiaoFollowUserFromDb': {
            let num = options.num
            toutiaoFollowUserFromDatabase(num)
            break
        }
        // 主动关怀未回关的，发提醒
        case "opt_tuotiao_sendmessageto_unfollowme": {
            opt_tuotiao_sendmessageto_unfollowme()
            break
        }
        // 维新，回关新粉，点评赞
        case 'toutiaoVisitNewFollers': {
            let offset = options.offset
            let maxnum = options.maxnum
            // 粉丝tab
            toutiaoFansUsersDealwith(offset, maxnum)
            break
        }
        case "opt_current_fans_page_toutiao_normal": {
            let offset = options.offset
            let maxnum = options.maxnum
            // 关注tab
            toutiaoFollowedsUsersDealwith(offset, maxnum)
            break
        }
        // 手动拉新
        case "toutiaoFetchNewUsers": {
            // 这里有三种拉取方式，其中悟空首页拉取最快，并且还附带点赞
            // 从相关文章找，信息最不好，因为没有desc，同时它也慢
            // 从问答榜单找，需要以名字搜索查用户，比较慢，每天限一次，同时页面容易不响应
            let source = options.source
            let useWukongSearch = options.useWukongSearch || true
            let res = { message: '' }
            console.log(source, useWukongSearch);
            // source: wukongHome/wentaRank/all
            if (source == 'wendaRank') {
                // 问答榜单一天拉一次就好了
                res = await toutiaoFetchNewUsersFromWendaRank(useWukongSearch)
                sendMessageToPupUp(res.message)
            } else if (source == 'wukongHome') {
                // 从悟空首页
                res = await toutiaoFetchNewUsersFromWukongHomePage()
                sendMessageToPupUp(res.message)
            } else if (source == 'relativeArticle') {
                // 从我的文章相关文章
                res = await toutiaoFetchNewUsersFromRelativeArticles()
                sendMessageToPupUp(res.message)
            } else if (source == 'all') {
                // 先从主页开始，最简单，很快
                // 其实最快的，每天多执行几遍这个就可以了
                res = await toutiaoFetchNewUsersFromWukongHomePage()
                sendMessageToPupUp(res.message)
                // 问答榜单一天拉一次就好了
                res = await toutiaoFetchNewUsersFromWendaRank(useWukongSearch)
                sendMessageToPupUp(res.message)
                // 从我的文章相关文章
                res = await toutiaoFetchNewUsersFromRelativeArticles()
                sendMessageToPupUp(res.message)
            }

            break
        }
        case "textInBg2": {
            // service.getTestUrl() 没问题
            // console.log("bg feedback",msg);
            // sendResponse('back from bg')
            testInBg()
            break
        }
        default:
        //
    }
});

// 向pupup展现一条消息，条件是popup正在弹出
function sendMessageToPupUp(message) {
    var views = chrome.extension.getViews({ type: 'popup' });
    if (views.length > 0 && views[0].showMessageTip) {
        views[0].showMessageTip(message)
    }
}

async function testInBg() {
    console.log("testInBg");
}

async function followMyFansAndSaveToDB() {
    let users = []

    let myHomeUrl = MY_HOME_URL
    console.log('myHomeUrl',myHomeUrl);
    let activeTabId = await createAndReturnNewTabId(myHomeUrl)
    let fanUsers = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.isFollowMyFans)
    await chrome.tabs.remove(+activeTabId)
    await sleep(1000 * SLEEP_FACTOR)
    console.log('fanUsers', fanUsers);

    for (const fanUser of fanUsers) {
        let searchUrl = `https://www.toutiao.com/search/?keyword=${fanUser.name}`
        let activeTabId = await createAndReturnNewTabId(searchUrl)
        let uid = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.csFetchUidFromUserSearchPage)
        await chrome.tabs.remove(+activeTabId)
        await sleep(1000 * SLEEP_FACTOR)

        console.log('uid',uid);
        let userWukongHomeUrl = `https://www.wukong.com/user/?uid=${uid}`
        activeTabId = await createAndReturnNewTabId(userWukongHomeUrl)
        let user = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.csFetchUserFromWukongUserHome, uid)
        await chrome.tabs.remove(+activeTabId)
        await sleep(1000 * SLEEP_FACTOR)
        console.log('user', user);

        user.desc = user.desc || '未有'
        if (user.uid > 0 && user.name !== ''){
            users.push(user)
        }
    }
    console.log('users', users);
    if (users.length > 0){
        let res = await service.toutiao.postUsers(users)
        if (res.code){
            console.log(`存储了${res.data}位用户`);
        }
    }
    
}

// 从库中拉取用户，每关注一下，修改一下数据库
async function toutiaoFollowUserFromDatabase(num) {
    console.log("testInBg");
    let res = { message: 'none' }
    let getNotFollowedUsersRes = await service.toutiao.getNotFollowedUsers(num)
    if (!getNotFollowedUsersRes.code) {
        console.log("err fetch data", getNotFollowedUsersRes.message)
        return res
    }
    let users = getNotFollowedUsersRes.data
    let numTotal = users.length
    let numComplete = 0
    let articleLinks = []

    for (let user of users) {
        let userTuotiaoHomeUrl = `https://www.toutiao.com/c/user/${user.uid}/`
        console.log('userTuotiaoHomeUrl', userTuotiaoHomeUrl);
        let activeTabId = await createAndReturnNewTabId(userTuotiaoHomeUrl)
        let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetArticleUrlsOfOneTuotiaoUser, 'cmd', {})
        // 取到链接了主动关闭tab
        // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
        // First convert the tabId to integer and then pass it to the remove funtion
        // console.log(+activeTabId)
        await chrome.tabs.remove(+activeTabId)
        // chrome.tabs.remove(activeTabId)
        // console.log("user articles executeTabResult", executeTabResult);
        console.log("这个用户有几篇文章", executeTabResult.length)
        let priority = 0

        for (let j = 0; j < executeTabResult.length; j++) {
            let link = executeTabResult[j]
            console.log("处理文章微头条", link);
            articleLinks.push({
                priority: j,
                url: link,
                user
            })

        }
        numComplete++
        console.log(`结束了用户${numComplete}/${numTotal}`, new Date().toLocaleTimeString())
        // if (numComplete > 5) break
        await sleep(1000)
    }
    console.log("排序", articleLinks);
    articleLinks.sort(function (a, b) {
        if (a.priority < b.priority) return -1
        else if (a.priority > b.priority) return 1
        else return 0
    });
    console.log("排序后", articleLinks);

    let numArticle = articleLinks.length
    for (let j = 0; j < numArticle; j++) {
        let item = articleLinks[j]
        console.log(`处理url ${j}/${numArticle}`, item.url)

        const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: item.url, active: false })
        let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, 'cmd', {})
        console.log("文章微头条处理结果", executeArticleTabResult)
        // 已经关注的，存库改状态
        if (executeArticleTabResult.followed) {
            // 如果已经关注过了，保存到数据库里，避免重复处理
            let dbSetRes = await service.toutiao.followUser(item.user.id)
            if (dbSetRes.code) {
                console.log(`已关注用户${item.user.name}`)
            }
        }
        // console.log(+articleTabId)
        await sleep(2000)//休息2秒
        await chrome.tabs.remove(+articleTabId)
    }

    res.message = `处理了${num}个用户`
    console.log(res.message);

    return res
}

// 从我的文章相关推荐拉新
async function toutiaoFetchNewUsersFromRelativeArticles() {
    // 只取第一页就可以了,20pic
    const myRecentArticleUrl = 'https://mp.toutiao.com/profile_v3/graphic/articles'
    let activeTabId = await createAndReturnNewTabId(myRecentArticleUrl)
    let recentArticles = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.csFetchMyRecentArticles, "cmd", {})
    await chrome.tabs.remove(+activeTabId)
    await sleep(1000)
    console.log("找到最新文章", recentArticles.length)

    let totalNum = recentArticles.length
    let numCompleted = 0
    let numArticles = 0
    let numHasFollowed = 0
    let users = []
    // 检查名称是否有不允许的字
    const checkUserNameHasIllicitWord = function (name) {
        const NOT_FOLLOWED_NAME_KEYS = ['网', '报', '车', '家居', 'App', '媒体', '在线', '头条', '阿里', '云计算', '杂志']
        for (let key of NOT_FOLLOWED_NAME_KEYS) {
            if (name.indexOf(key) > -1) return true
        }
        return false
    }

    for (let j = 0; j < totalNum; j++) {
        let link = recentArticles[j]
        console.log("开始查找它的相关推荐", link);
        let articleTabId = await createAndReturnNewTabId(link)
        let findAboutArticlesResult = await chrome.tabs.executeAsyncFunction(articleTabId, toutiao.csFindRelativeArticlesFromOneArticle, 'cmd', {})
        console.log("相关推荐列表", findAboutArticlesResult);//此时拿到了相关文章列表
        await chrome.tabs.remove(+articleTabId)
        await sleep(1000)//休息1秒
        // findAboutArticlesResult = findAboutArticlesResult.slice(3,6)
        // 开始处理这些文章
        for (let k = 0; k < findAboutArticlesResult.length; k++) {
            let relativeLink = findAboutArticlesResult[k]
            console.log("处理文章微头条", relativeLink);
            let relativeArticleTabId = await createAndReturnNewTabId(relativeLink)
            let user = await chrome.tabs.executeAsyncFunction(relativeArticleTabId, toutiao.csFetchUserFromOneToutiaoArticle, 'cmd', {})
            // desc默认是空的，没有取用
            if (user.uid > 0 && user.name != '' && !checkUserNameHasIllicitWord(user.name)) {
                user['interactive_value'] = 5
                users.push(user)
                console.log("文章中取到用户并添加", user);
            }
            // console.log(+articleTabId)
            await sleep(1000)//休息1秒
            await chrome.tabs.remove(+relativeArticleTabId)
            numArticles++
        }
        numCompleted++
        console.log(`处理了：${numArticles}篇文章，${Math.round(100 * numCompleted / totalNum)}% ${numCompleted}/${totalNum}`, new Date().toLocaleTimeString());
        // 临时限制
        // if (users.length > 1) break
    }
    console.log("这些文章处理完了", new Date().toLocaleTimeString());

    let res = { message: 'none' }
    if (users.length > 0) {
        console.log("users", users);

        res = await service.toutiao.postUsers(users)
        console.log("postUsers接口调用结果", res);
        if (res.code) {
            console.log(`新增了${res.data}名相关推荐用户，有待关注`)
        }
    }

    return res
}

// 从问答青云榜拉取需关注的作者列表
async function toutiaoFetchNewUsersFromWendaRank(userWukongSearch = false) {
    console.log("从问答青云榜拉新");

    const url = `http://i.snssdk.com/rogue/ugc_app_inside/wenda/ranking.html`
    let activeTabId = await createAndReturnNewTabId(url)
    // let userNames = ["令狐冲说动漫"]
    let userNames = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.csFetchUserNamesFromWendaRank, 'fetch', { arg: 123 })
    console.log("cs代码操作结果1", userNames);
    await chrome.tabs.remove(+activeTabId)
    await sleep(2000) //休息2秒

    let users = []
    let totalNum = userNames.length
    // let userWukongSearch = false

    for (let userName of userNames) {
        let url, user
        if (userWukongSearch) {
            url = `https://www.wukong.com/search/?keyword=${userName}`
        } else {
            url = `https://www.toutiao.com/search/?keyword=${userName}`
        }
        // 当前同一个tab打开
        // await chrome.tabs.reloadAndWait(activeTabId, {url,active:false})
        let tabId = await createAndReturnNewTabId(url)
        if (userWukongSearch) {
            // 使用悟空搜索
            user = await chrome.tabs.executeAsyncFunction(tabId, toutiao.csFetchUserFromWukongSearchPage, 'fetch', { arg: 123 })
        } else {
            // 头条搜索
            user = await chrome.tabs.executeAsyncFunction(tabId, toutiao.csFetchUserFromToutiaoSearchPage, 'fetch', { arg: 123 })
        }
        user['is_qing_yun'] = 1 // 问答青云作者=1，默认为0
        if (user.uid > 0 && user.name != '' && user.desc != '') {
            user['interactive_value'] = 5
            users.push(user)
        }
        await sleep(1500) //搜索一个休息1秒
        await chrome.tabs.remove(+tabId)
        console.log(`${users.length}/${totalNum} user`, user);
        // if (users.length > 10) break
    }
    console.log("cs代码操作结果2", users);
    let res = { message: 'none' }
    if (users.length > 0) {
        res = await service.toutiao.postUsers(users)
        console.log("接口调用结果", res);
        if (res.code) {
            console.log(`新增了${res.data}名问答青云用户，有待关注`)
        }
    }

    return res
}

// 从悟空首页拉新
async function toutiaoFetchNewUsersFromWukongHomePage() {
    console.log("从悟空首页拉新");
    console.log("SLEEP_FACTOR",SLEEP_FACTOR)
    // return {message:'ok'}
    // const window = await injectJavaScriptModule('js/toutiao.js')
    const url = `https://www.wukong.com`
    let activeTabId = await createAndReturnNewTabId(url)
    // let activeTabId = await getCurrentActiveTabId()
    // let users = [{name: "小猪罗纪", link: "https://www.wukong.com/user/?uid=71889677568", desc: "影视领域创作者", uid: 71889677568}
    // ,{name: "太平洋电脑网", link: "https://www.wukong.com/user/?uid=3389144301", desc: "头条青云获奖者 优质数码领域创作者", uid: 3389144301}]
    // Execute Injected Scripts Asynchronously With chrome.tabs.executeAsyncFunction
    let users = await chrome.tabs.executeAsyncFunction(activeTabId, toutiao.csFetchUserListFromWukongHomePage, 'fetch', { arg: 123 })
    console.log("cs代码操作结果", users);
    let res = await service.toutiao.postUsers(users)
    console.log("接口调用结果", res);
    if (res.code) {
        console.log(`新增了${res.data}名用户，有待关注`)
    }
    return res
}

// old testBg2 method
// getUrl()

// alert(100)
// async 
// "js/chrome-extension-async.js","js/execute-async-function.js"
// require(["js/tuotiao"], async (tuotiao)=> {
//     // async function getCurrentTabid(){

//     // }
//     // getCurrentTabid()
//     // let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
//     //     let articleTabId = tabs[0].id
//     //     let executeAnswerTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tuotiao.fetchUsers, 'cmd', {})
//     //     console.log("测试结果", executeAnswerTabResult);

//         //use the modules as usual.
//         tuotiao.name += new Date().getTime()
//         let info = await tuotiao.sayInfo()
//         console.log('ok', info);
//         // let tabid = await tuotiao.openNewTab()
//         // console.log('ok',tabid);

//     });
// console.log("injectFunction",injectFunction);

// injectFunction()
// 测试向cs发消息，没问题
// let response = await sendMessageToContentScriptFromBackground({cmd: 'testfrombg', greeting: '你好，我是bg，发消息给contentscript！'});
// console.log('收到来自contentscript的回复：' + response);

// let tsScriptFunc = async function (cmd, options) {
//     // function injectJavaScriptFile(jsPath) {
//     //     // jsPath = jsPath || 'js/inject.js';
//     //     var temp = document.createElement('script');
//     //     temp.setAttribute('type', 'text/javascript');
//     //     // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
//     //     // let jsPath = `chrome-extension://ohalocmgefnhpgabnnifegjeglfonepj/${jsPath}`
//     //     console.log('file',jsPath);
//     //     temp.src = chrome.extension.getURL(jsPath);
//     //     temp.onload = function () {
//     //         // 放在页面不好看，执行完后移除掉
//     //         // this.parentNode.removeChild(this);
//     //     };
//     //     document.head.appendChild(temp);
//     // }
//     // 这是在cs中注入到页面的
//     // window.yyconfig.name = 'other'
//     // let result=GLOBAL_COMMENTS_ARRAY2[0]+ window.yyconfig.name
//     // injectJavaScriptFile('js/main.js')
//     // for (let j=0;j<10;j++){
//     //     // 不能调用里面的方法
//     //     if (undefined != injectFunction){
//     //         result= injectFunction(cmd,options)
//     //         break
//     //     }else{ await sleep(1000)}
//     // }

//     // require(['math'], function (math){

//     //     　　　　alert(math.add(1,1));

//     //     　　});

//     let result = document.querySelector("div.w-feed-container").children
//     // 测试在cs中能否操作dom，然后在bg中返回操作结果并使用，答案可以
//     // 所以pickOneComment可以
//     // result = testQueryAvatarLink()

//     return result
//     // window.injectFunction()
//     // return 'ok'
// }


// call api http://t.weather.sojson.com/api/weather/city/101030100
// 在bg中可以正常请求
// $.ajax({
//     url: "http://t.weather.sojson.com/api/weather/city/101030100"
//     , success: res => {
//         console.log("res", res);

//     }, error: (xhr, err) => {
//         console.log("err", err);

//     }
// })

// 定时，没有问题
// oneDayExecutFunc({
//     interval: 1, //间隔天数，间隔为整数
//     runNow: true, //是否立即运行
//     time: "23:22:00" //24h,执行的时间点 时在0~23之间
// }, ()=>{
//     console.log('---timeer.---');

// })

// injectJavaScriptFile('js/tuotiao.js')

// 头条
async function startTuotiaoActivity(cmd, options = {}) {
    console.log("startTuotiaoActivity", cmd, options);

    /*
    // 测试悟空单条问答的点赞、评论
    let link = 'https://www.wukong.com/question/6683732151399088387/?origin_source=user_profile_answer_tab'
    console.log("开始处理回答", link);
    const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
    let executeAnswerTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserWukongAnswer, 'cmd', {})
    console.log("问答处理结果", executeAnswerTabResult);
    return
    */
    /*
    // 测试在悟空问答关注，没问题
    let url = 'https://www.wukong.com/user/?uid=3966651662336718&type=0'
    let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
     let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetAnswerUrlsOfOneTuotiaoWukongUser, 'cmd', {})
     // 取到链接了主动关闭tab
     // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
     // First convert the tabId to integer and then pass it to the remove funtion
     // console.log(+activeTabId)
     console.log("executeTabResult",executeTabResult);
     // await chrome.tabs.remove(+activeTabId)
     return
     */
    /**
    // 测试为什么给自己的评论点赞，为什么不好使？
    let link = `https://www.toutiao.com/i6812871279440298503/`
    const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
    let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, 'cmd', {})
    console.log("executeArticleTabResult", executeArticleTabResult);
    // console.log(+articleTabId)
    return
     */
    /**
    // 测试微头条页面，能不能像文章一样点赞评论？没问题
    let link = `https://www.toutiao.com/a1663859223171085`
    const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
    let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, 'cmd', {})
    console.log("executeArticleTabResult", executeArticleTabResult);
    return
     */
    /**
    // 测试给一个用户点赞评论，可以，没问题
    let url = `https://www.toutiao.com/c/user/2049101948790391/#mid=1659965175548931`
    await startToGetOneUserTuotiaoArticles(url)
    return
    */
    // 
    switch (cmd) {
        case "open_all_tuotiao_article_and_comment": {
            tuoTiaoFetchMyLoginFollowerList('all')
            break
        }
        case "open_firstscreen_tuotiao_article_and_comment": {
            tuoTiaoFetchMyLoginFollowerList('firstscreen')
            break
        }
        case "praise_and_comment_from_user_article_comments": {
            tuoTiaoFetchCommentUsersFromArticleComment()
            break
        }
        case "from_my_article_to_follow_authors": {
            tuotiaoFromMyArticleToFollowMyArticleAboutArticleAuthors()
            break
        }
        // case "testInBg": {
        //     // injectFunction()
        //     testInBg()
        //     break
        // }
        case "opt_current_fans_page_toutiao": {
            opt_current_fans_page_toutiao({ unfollow: true })
            break
        }
        case "opt_onlyreplayfollow_toutiao": {
            opt_current_fans_page_toutiao({ unfollow: true, onlyReplayFollow: true })
            break
        }
        // 给新关粉送关怀
        case "opt_noreplayfollow_but_praiseandcomment_toutiao": {
            opt_noreplayfollow_but_praiseandcomment_toutiao()
            break
        }

        // 从当前页文章的评论，回馈评论者
        case "opt_tuotiao_pcff_from_curren_article": {
            opt_tuotiao_pcff_from_curren_article()
            break
        }
        case "opt_tuotiao_followuser_from_current_article": {
            opt_tuotiao_followuser_from_current_article()
            break
        }
        // 
        // 
        // 
        default:
        //
    }
}
// 从当前文章开始，关注作者，并点评赞
async function opt_tuotiao_followuser_from_current_article() {
    let yyconfig = await sendMessageToContentScriptFromBackground("resetConfig")
    console.log("配置", JSON.stringify(yyconfig));
    // return

    let articleTabId = null // articleTabId If null this will be the current tab
    let findUserListFromArticleCommentResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsFindUserListFromArticleComments, 'cmd', {})
    console.log("当前文章评论者列表", findUserListFromArticleCommentResult);//此时拿到了新互动的用户列表
    // await chrome.tabs.remove(+articleTabId)
    await sleep(1000)//处理完一个页面，休息1秒
    // 开始处理点赞的用户列表
    // 临时变一下
    // findUserListFromArticleCommentResult = findUserListFromArticleCommentResult.slice(3)
    await tuotiaoDealWithUsers(findUserListFromArticleCommentResult)
}

async function opt_tuotiao_pcff_from_curren_article() {
    let yyconfig = await sendMessageToContentScriptFromBackground("resetConfig")
    console.log("配置", JSON.stringify(yyconfig));
    // return

    let articleTabId = null // articleTabId If null this will be the current tab
    let findUserListFromArticleCommentResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsFindUserListFromArticleComments, 'cmd', {})
    console.log("评论者列表", findUserListFromArticleCommentResult);//此时拿到了新互动的用户列表
    // await chrome.tabs.remove(+articleTabId)
    await sleep(1000)//处理完一个页面，休息1秒
    // 开始处理点赞的用户列表
    // 临时变一下
    // findUserListFromArticleCommentResult = findUserListFromArticleCommentResult.slice(3)
    await tuotiaoDealWithUsers(findUserListFromArticleCommentResult)
}
// 粉丝tab
async function tsToutiaoFansUsersDealwith(offset = 0, maxnum = 100) {
    let links = []
    let fansNum = 0;

    let followNumAs = document.querySelectorAll("a[ga_event=nav_user_list] .y-number")
    if (followNumAs.length > 1) {
        let fansNumA = followNumAs[1]
        fansNum = parseInt(fansNumA.textContent)
    }

    fansNum = Math.min(maxnum, fansNum)

    // 粉丝tab
    let folledBtn = document.querySelector("li[code=followed]")
    if (folledBtn) folledBtn.click()
    await sleep(1000)

    // 粉丝tab
    // 最近的粉丝，互动之，不管关注未关注
    // let followBtns = document.querySelectorAll("span.btn-attention")
    for (let j = 0; j < 100; j++) {
        window.scrollBy(0, 1000)
        await sleep(1000)
        if (document.querySelector("ul.media").children.length >= (fansNum)) break
    }

    let followBtns = document.querySelectorAll("span.btn-attention")
    for (let followBtn of followBtns) {
        let followed = false
        // 回关不放在这里，放在每个页面里更好
        // 如果未回关呢，回关之
        // if (!followBtn.classList.contains("each")){
        //     followBtn.click()
        //     window.scrollBy(0, 10)
        //     await sleep(1000)
        //     followed = true 
        // }

        try {
            let userItem = followBtn.parentElement.parentElement.parentElement
            let userLink = userItem.querySelectorAll("a[ga_event=user_list_click]")[1]
            links.push({
                url: userLink.href,
                followed
            })
            console.log('关注了' + userLink.textContent);
        } catch (error) { }
    }
    if (offset) links = links.slice(offset)

    return links
}

// 关注tab
async function tsToutiaoFollowedUsersDealwith(offset = 0, maxnum = 100) {
    let links = []
    let followNum = 0

    let followNumAs = document.querySelectorAll("a[ga_event=nav_user_list] .y-number")
    if (followNumAs.length > 0) {
        let followNumA = followNumAs[0]
        followNum = parseInt(followNumA.textContent)
    }

    followNum = Math.min(maxnum, followNum)

    // 关注 tab
    let follingBtn = document.querySelector("li[code=following]")
    if (follingBtn) follingBtn.click()
    await (1000)

    for (let j = 0; j < 100; j++) {
        window.scrollBy(0, 1000)
        await sleep(1000)
        if (document.querySelector("ul.media").children.length >= (followNum)) break
    }

    // 处理已关注粉
    let followBtns = document.querySelectorAll("dl.media-list")
    for (let followBtn of followBtns) {
        let userLink = followBtn.querySelector("a[ga_event=user_list_click]")
        links.push(userLink.href)
    }
    if (offset) links = links.slice(offset)

    return links
}

// 获取未回关粉丝的主页列表
// 自动往下滚动，
async function tsUnfollowedFetchFansHomePage(cmd, options) {
    let unfollow = options.unfollow || false
    let onlyReplayFollow = options.onlyReplayFollow || false
    let links = []
    let followNum = 0, fansNum = 0;

    let followNumAs = document.querySelectorAll("a[ga_event=nav_user_list] .y-number")
    if (followNumAs.length > 0) {
        let followNumA = followNumAs[0]
        followNum = parseInt(followNumA.textContent)
    }
    if (followNumAs.length > 1) {
        let fansNumA = followNumAs[1]
        fansNum = parseInt(fansNumA.textContent)
    }

    // followNum=10
    // fansNum=10

    if (unfollow) {//宠爱未关注粉丝
        // 粉丝tab
        let folledBtn = document.querySelector("li[code=followed]")
        if (folledBtn) folledBtn.click()
        await sleep(1000)

        // 粉丝tab
        // 最近的粉丝，互动之，不管关注未关注
        // let followBtns = document.querySelectorAll("span.btn-attention")
        for (let j = 0; j < 100; j++) {
            window.scrollBy(0, 1000)
            await sleep(1000)
            if (document.querySelector("ul.media").children.length >= fansNum) break
        }

        let followBtns = document.querySelectorAll("span.btn-attention:not(.each)")
        for (let followBtn of followBtns) {
            // if (!followBtn.classList.contains("each")){
            //     followBtn.click()
            //     window.scrollBy(0,10)
            //     await sleep(200)
            // }
            followBtn.click()
            window.scrollBy(0, 10)
            await sleep(200)

            if (!onlyReplayFollow) {
                try {
                    let userItem = followBtn.parentElement.parentElement.parentElement
                    let userLink = userItem.querySelectorAll("a[ga_event=user_list_click]")[1]
                    links.push(userLink.href)
                    console.log('关注了' + userLink.textContent);
                } catch (error) { }
            }
        }
    } else {
        // 关注 tab
        let follingBtn = document.querySelector("li[code=following]")
        if (follingBtn) follingBtn.click()
        await (1000)

        for (let j = 0; j < 100; j++) {
            window.scrollBy(0, 1000)
            await sleep(1000)
            if (document.querySelector("ul.media").children.length >= followNum) break
        }

        // 处理已关注粉
        let followBtns = document.querySelectorAll("dl.media-list")
        for (let followBtn of followBtns) {
            let userLink = followBtn.querySelector("a[ga_event=user_list_click]")
            links.push(userLink.href)
        }
    }

    return links
}

async function tsForMyUnfollowedFetchFansHomePageAndPraiseetc(cmd, options) {
    let links = []
    let followBtns = document.querySelectorAll("span.btn-attention:not(.each)")
    for (let followBtn of followBtns) {
        try {
            let userItem = followBtn.parentElement.parentElement.parentElement
            let userLink = userItem.querySelectorAll("a[ga_event=user_list_click]")[1]
            links.push(userLink.href)
            console.log('开始关怀' + userLink.textContent);
        } catch (error) { }
    }

    return links
}

// 关注tab
async function tsForopt_tuotiao_sendmessageto_unfollowme(cmd, options) {
    let links = []
    let followNum = 0

    let followNumAs = document.querySelectorAll("a[ga_event=nav_user_list] .y-number")
    if (followNumAs.length > 0) {
        let followNumA = followNumAs[0]
        followNum = parseInt(followNumA.textContent)
    }

    // followNum = Math.min(100, followNum)

    // 关注 tab
    let follingBtn = document.querySelector("li[code=following]")
    if (follingBtn) follingBtn.click()
    await (1000)

    for (let j = 0; j < 100; j++) {
        window.scrollBy(0, 1000)
        await sleep(1000)
        if (document.querySelector("ul.media").children.length >= followNum) break
    }

    // let links = []
    let followBtns = document.querySelectorAll("span.btn-attention.following")
    // 每次处理50个未回关的人
    // let maxNum = 50
    for (let followBtn of followBtns) {
        // followBtn = followBtn.parentElement?.parentElement?.parentElement
        if (followBtn.parentElement) followBtn = followBtn.parentElement
        if (followBtn.parentElement) followBtn = followBtn.parentElement
        if (followBtn.parentElement) followBtn = followBtn.parentElement
        let userLink = followBtn.querySelectorAll("a[ga_event=user_list_click]")
        if (userLink.length > 1) {
            userLink = userLink[1]
            if (userLink.textContent.indexOf('头条') < 0) {
                links.push(userLink.href)
                console.log('开评赞提醒回关' + userLink.textContent);
            }
        }
        // if (links.length>maxNum) break
    }

    return links
}

// 投我以木瓜，报之以琼琚。匪报也，永以为好也！
// 　　投我以木桃，报之以琼瑶。匪报也，永以为好也！
// 　　投我以木李，报之以琼玖。匪报也，永以为好也！
// 给未关注我的，未回关的，发点评消息
async function opt_tuotiao_sendmessageto_unfollowme() {
    let yyconfig = {
        maxNumArticleAndWetoutiaoToDealWith: 1,
        maxNumWukongAnswersToDealWith: 1,
        requireFollowUser: false
        , oneComment: '投我以木桃，报之以琼瑶'//
        , useOneComment: true
    }
    // console.log("配置", JSON.stringify(yyconfig));
    // return

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let activeTabId = tabs[0].id
    let fansHomePagesResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsForopt_tuotiao_sendmessageto_unfollowme, 'cmd', {})
    console.log("有多少未回关粉丝，先关怀下", fansHomePagesResult.length)
    // 33/56 临时数字调整
    // fansHomePagesResult = fansHomePagesResult.slice(6)
    await tuotiaoDealWithUsers(fansHomePagesResult, yyconfig)
}

// 当前页操作
// 有多少未回关粉丝，不能关注，先关怀下，每人最多点赞6次
async function opt_noreplayfollow_but_praiseandcomment_toutiao(options = {}) {
    let yyconfig = await sendMessageToContentScriptFromBackground("setConfig", {
        maxNumArticleAndWetoutiaoToDealWith: 3,
        maxNumWukongAnswersToDealWith: 3,
        requireFollowUser: false
    })
    console.log("yyconfig", yyconfig);

    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let activeTabId = tabs[0].id
    let fansHomePagesResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsForMyUnfollowedFetchFansHomePageAndPraiseetc, 'cmd', options)
    console.log("有多少未回关粉丝，先关怀下", fansHomePagesResult.length)
    // 33/56 临时数字调整
    // fansHomePagesResult = fansHomePagesResult.slice(33)
    await tuotiaoDealWithUsers(fansHomePagesResult)
}

// 当前页粉线回以点评赞
async function opt_current_fans_page_toutiao(options) {
    // let unfollow = options.unfollow || false
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let activeTabId = tabs[0].id
    let fansHomePagesResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsUnfollowedFetchFansHomePage, 'cmd', options)
    console.log("有多少粉丝", options, fansHomePagesResult.length)
    await tuotiaoDealWithUsers(fansHomePagesResult)
}

// 处理粉丝tab用户
async function toutiaoFansUsersDealwith(offset, maxnum) {
    let activeTabId = await getCurrentActiveTabId()
    let mapLinks = await chrome.tabs.executeAsyncFunction(activeTabId, tsToutiaoFansUsersDealwith, offset, maxnum)
    console.log("有多少粉丝", mapLinks.length)
    let links = mapLinks.map(item => {
        // followed,url
        // 新粉需要特别处理吗？
        return item.url
    })

    await tuotiaoDealWithUsers(links)
}

// 处理关注tab用户
async function toutiaoFollowedsUsersDealwith(offset, maxnum) {
    let activeTabId = await getCurrentActiveTabId()
    let fansHomePagesResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsToutiaoFollowedUsersDealwith, offset, maxnum)
    console.log("有多少粉丝", fansHomePagesResult.length)
    await tuotiaoDealWithUsers(fansHomePagesResult)
}

// 获取当前选项卡ID
function getCurrentTabId(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (callback) callback(tabs.length ? tabs[0].id : null);
    });
}
function getNewTabId(url, callback) {
    chrome.tabs.create({ url, active: true }, function (tab) {
        console.log("tabId2", tab.id)
        var tabId = tab.id;
        if (callback) callback(tabId);
    });
}
// 向content-script注入JS片段
function executeScriptToCurrentTab(code) {
    getCurrentTabId((tabId) => {
        chrome.tabs.executeScript(tabId, { code: code });
    });
}
function executeFileScriptToNewTab(url, jsFile) {
    getNewTabId(url, (tabId) => {
        console.log("tabId1", tabId)
        chrome.tabs.executeScript(tabId, { file: jsFile });
    });
}
function executeFileScriptToCurrentTab(jsFile) {
    getCurrentTabId((tabId) => {
        chrome.tabs.executeScript(tabId, { file: jsFile });
    });
}
async function executeAsyncFileScript(jsFile) {
    try {
        // Query the tabs and continue once we have the result
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        // Execute the injected script and continue once we have the result
        const results = await chrome.tabs.executeScript(activeTab.id, { file: jsFile, runAt: "document_idle" });
        const firstScriptResult = results;
        return firstScriptResult;
    }
    catch (err) {
        // Handle errors from chrome.tabs.query, chrome.tabs.executeScript or my code
    }
}
async function executeAsyncScript(code) {
    try {
        // Query the tabs and continue once we have the result
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        // Execute the injected script and continue once we have the result
        const results = await chrome.tabs.executeScript(activeTab.id, { code, runAt: "document_idle" });
        const firstScriptResult = results;
        return firstScriptResult;
    }
    catch (err) {
        // Handle errors from chrome.tabs.query, chrome.tabs.executeScript or my code
    }
}

// ===================
// http://open.chrome.360.cn/extension_dev/content_scripts.html



// 在tab中执行的代码，取出一定时期内作者写的文章链接，还有微头条链接
// 经验证，微头条与文章是一样的页面结构，可以同等对待
// √可以传入，可以返回
// √能否在一个新tab里,可以
// √能否在新的tab里取到dom元素
// 注意：这个里面的代码，必须在这里完全定义，因为作用域不一样
// √能不能引入util工具类？不需要引入了，工具类直接在content-script中定义
async function tsGetArticleUrlsOfOneTuotiaoUser(cmd, options) {
    // 
    const sleep = async function (ms) {
        let temple = new Promise(
            (resolve) => {
                console.log("sellep", ms);
                setTimeout(resolve, ms)
            });
        return temple
    }
    // 这个页面有ajax加载，不需要额外等待了
    // 等待3秒，等待页面ajax加载完成
    // 这个异步脚本并不会阻塞tab本身的代码，至少在当前这种模式下
    // 先前没有取到dom，是因为页面中的ajax数据加载还没有完成
    // 保证ajax加载完成了，可以正常取到文章列表
    await sleep(500)
    let links = []

    // 需要查看一下用户有多少粉，如果过万、万千就直接跳过吧，太多粉丝的不care me
    // let fansNumItem = document.querySelectorAll("a[ga_event=nav_user_list] [riot-tag=number]")
    // if (fansNumItem) {
    //     fansNumItem = fansNumItem[1]
    //     let fansNum = fansNumItem.attributes.number.value
    //     if (fansNum > 1000) return links
    // }

    // 点一下文章tab
    let articleTabBtn = document.querySelectorAll(`div.tab-item`)[1]
    if (articleTabBtn) {
        articleTabBtn.click()
        await sleep(2000) // 这个ajax有点长，停留2秒
    }

    let artileItems
    for (let j = 0; j < 3; j++) {
        artileItems = document.querySelectorAll("div[class=article-card]")
        if (artileItems && artileItems.length > 0) {
            break
        } else {
            await sleep(1000)
        }
    }
    // await sleep(5000)
    // await promises in the tab
    // let artileItems = document.querySelector("li.item[ga_event=feed_item_click]")
    // console.log(artileItems);

    // 原理上只处理3天内的文章，理论上是处理上次处理时间之后的
    // 时间太短的话，不能达到效果，试试20天的效果
    // 20天之内的，但是有人一天发好几篇，总数不能超过8篇
    const MAX_ALLOW_DAYS = 20 // 原理上只处理10天内的文章，理论上是处理上次处理时间之后的
    const nowDate = new Date()
    let numTotal = 0
    const maxNumToDealWith = window.yyconfig.maxNumArticleAndWetoutiaoToDealWith

    for (let j = 0; j < artileItems.length; j++) {
        let item = artileItems[j]
        // let timeSpan = item.querySelector("div.title-box")
        // if (timeSpan) {
        //     let articleDate = new Date(timeSpan.textContent.substr(2))
        //     if (articleDate) {
        //         let ms = nowDate.getTime() - articleDate.getTime()
        //         let numDays = ms / (1000 * 60 * 60 * 24)

        //         // 只处理1天之内的文章
        //         if (numDays < MAX_ALLOW_DAYS) {
        //             let linkItem = item.querySelector("a.link.title")
        //             if (linkItem) links.push(linkItem.href)
        //             numTotal++
        //         }
        //     }
        // }
        let linkItem = item.querySelector("a.link.title")
        if (linkItem) links.push(linkItem.href)
        numTotal++
        // 超过15篇就可以了，不需要过多
        if (numTotal >= maxNumToDealWith) break
    }

    // 点一下微头条tab，开始查微头条链接
    let wetoutiaoBtn = document.querySelectorAll(`div.tab-item`)[3]
    if (wetoutiaoBtn) {
        wetoutiaoBtn.click()
        await sleep(2000) // 这个ajax有点长，停留2秒
        // let artileItems
        for (let j = 0; j < 3; j++) {
            artileItems = document.querySelectorAll("div[class=weitoutiao-card]")
            if (artileItems && artileItems.length > 0) {
                break
            } else {
                await sleep(1000)
            }
        }
        // 和文章放在一起，最多10篇
        let n = Math.min(maxNumToDealWith - numTotal, artileItems.length)
        if (artileItems.length > 0 && n > 0) {
            for (let j = 0; j < n; j++) {
                let item = artileItems[j]
                // let timeSpan = item.querySelector("div.ugc-content")
                // if (timeSpan) {
                //     let articleDate = new Date(timeSpan.textContent.substr(3))
                //     if (articleDate) {
                //         let ms = nowDate.getTime() - articleDate.getTime()
                //         let numDays = ms / (1000 * 60 * 60 * 24)
                //         // 只处理1天之内的文章
                //         if (numDays < MAX_ALLOW_DAYS) {
                //             let linkItem = item.querySelector("a[ga_event=ugc_read_count]")
                //             if (linkItem) links.push(linkItem.href)
                //         }
                //     }
                // }
                let linkItem = item.querySelector("div.ugc-content a")
                if (linkItem) links.push(linkItem.href)
                numTotal++
                // 超过15篇就可以了，不需要过多
                if (numTotal >= maxNumToDealWith) break
            }
        }
    }

    // console.log(a, b);
    // 已经执行到这里了
    return links
}

// 在一篇文章中执行的js脚本，收藏点赞评论等
// 页面链接例如：https://www.toutiao.com/i6918660523663950339/
async function tsDealWithToutiaoUserArticle(config) {

    // const MY_TUOTIAO_NAME = '程序员LIYI'
    // 点赞之前，先休息半秒，模块页面加载
    await sleep(500)
    window.scrollBy(0, 500)//滚动一下

    let objResult = { followed: false }
    let result = []
    let hasPraiseIt = false

    window.yyconfig = Object.assign(window.yyconfig, config)

    // 在文章页面，如果没有关注它，则主动关注
    if (window.yyconfig.requireFollowUser) {
        let followArticleAuthorBtn = document.querySelector("div.user-subscribe-wrapper")
        if (followArticleAuthorBtn) {
            followArticleAuthorBtn.click()
            let authorNameItem = followArticleAuthorBtn.parentElement.querySelector("a[class=name]")
            if (authorNameItem) console.log('关注了作者', authorNameItem.textContent);
            result.push('关注done')
            await sleep(200)
            if (authorNameItem) objResult.focus = authorNameItem.href
            // objResult.followed = true
        }
        objResult.followed = true
    }

    // 稍后要注释掉这一段
    // else{
    //     // 关注过了，主动回访一下
    //     followArticleAuthorBtn = document.querySelector("div.left-arrow.unsubscribe-btn")
    //     if (followArticleAuthorBtn){
    //         let authorNameItem = followArticleAuthorBtn.parentElement.parentElement.querySelector("a")
    //         if (authorNameItem) objResult.focus = authorNameItem.href
    //     }
    // }

    // 收藏，查找没有点赞的，单击收藏
    // 收藏过颜色 color: #ffbd1d; "rgb(255, 189, 29)"
    // 未收藏颜色 color: #cacaca; "rgb(202, 202, 202)"
    let favoriteItem = document.querySelector("i.icon-favorite_line")
    if (getComputedStyle(favoriteItem).getPropertyValue("color") === "rgb(202, 202, 202)") {
        //如果是灰色，未点赞，当赞之，收藏
        favoriteItem.click();
        result.push('收藏done')
        await sleep(200)
    } else {
        hasPraiseIt = true
    }
    // console.log("hasPraiseIt",hasPraiseIt);
    // 评论
    // commentTextarea = document.querySelector("div[ga_event=click_input_comment]>textarea")
    // document.querySelector("div.c-submit").click()

    // 给自己的评论点赞一下
    const praiseMyComment = async function (commentItem) {
        // 赞过之后，会多一个"active"样式
        // 查找一个没有赞过的一条评论，可能是自己的，没有关系
        // 这是一条骚气的查询
        let userLinkPraiseBtn = document.querySelector(`span.digg:not(.active)`)
        if (userLinkPraiseBtn) {
            userLinkPraiseBtn.click()
            result.push(`点赞评论done`)
            await sleep(200)//每个拟人操作完成，都要暂停200毫秒
        }
    }

    // 如果没收藏过，代表没评论过，评论之
    let requireComment = window.yyconfig.useOneComment || !hasPraiseIt
    console.log("requireComment1", requireComment, hasPraiseIt, window.yyconfig);


    // 生成一条评论，从池子中选择，或者从已有评论中选一条
    const pickOneComment = async function () {
        // 如果有评论配置，直接返回
        if (window.yyconfig.useOneComment) return window.yyconfig.oneComment

        let comment = ''
        let commentItems = document.querySelectorAll("div.comment-item")
        let diggNum = 0
        for (let commentItem of commentItems) {
            // 取出高赞评论，作为评论内容，模拟真实性
            let diggLink = commentItem.querySelector("i.bui-icon.icon-thumbsup_line")
            if (diggLink) {
                diggLink.click()
                await sleep(200)
                if (parseInt(diggLink.textContent) > diggNum) {
                    diggNum = parseInt(diggLink.textContent)
                    let userLink = commentItem.querySelector("div.user-info a.name")
                    if (userLink && userLink.text != MY_TUOTIAO_NAME) {
                        let commentContentText = commentItem.querySelector("p.content")
                        if (commentContentText) comment = `${commentContentText.textContent}\n+1`
                    }
                }
            }
        }

        // 如果没有找到高赞评论，制造一条
        if (diggNum < 5 || !comment) {
            let n = Math.round(Math.random() * 100) % (GLOBAL_COMMENTS_ARRAY.length - 1)
            comment = GLOBAL_COMMENTS_ARRAY[n] || '好' //"写的真是太好的，先收藏，回头研究下好好"
            if (Math.random() > 0.5) comment = `${comment}\n[赞]`
            if (Math.random() > 0.5) comment = `${comment}\n[666]`
        }

        return comment
    }

    console.log("requireComment", requireComment, window.yyconfig);
    // requireComment = true //每次都需要评论一下

    // https://www.toutiao.com/api/pc/2/data/v5/post_message/?aid=24&app_name=toutiao-web
    if (requireComment) {
        // 如果是转发的内容，有这个标识
        if (!document.querySelector("div.original-info")) {
            // 不是转发的，原创才评它
            window.scrollBy(0, 300)//再滚动一下
            // 如果没有评过，评一条
            // 模拟单击打开效果
            let commentWrapDiv = document.querySelector("div.input-textarea")
            if (commentWrapDiv) {
                commentWrapDiv.click()
                commentWrapDiv.classList.add("expand")
            }
            let commentTextarea = document.querySelector("div.input-textarea > textarea")
            if (commentTextarea) {
                // let commentTextarea = commentDiv.querySelector("textarea")
                // 这是vue框架开发的页面应用，直接给textarea赋值，并不能改变它的值，因为内部依赖input事件改变输入时绑定的v-model
                // 所以必须先改变value，再派发一个input event，再点按钮提示
                // commentTextarea.value = "写的真是太好了赞"
                // commentEvent = document.createEvent("event")
                // commentEvent.initEvent('input', true, true);
                // commentTextarea.dispatchEvent(commentEvent)
                commentTextarea.click()
                await sleep(200)

                // commentTextarea.focus()
                let comment = await pickOneComment()
                commentTextarea.value = comment
                let commentEvent = document.createEvent("event")
                commentEvent.initEvent('input', true, true);
                commentTextarea.dispatchEvent(commentEvent)
                await sleep(200)

                let commentBtn = document.querySelector("button.submit-btn")
                if (commentBtn) commentBtn.click()
                result.push(`评论done:${comment}`)
                await sleep(200)
            }
        } else {
            console.log('是转发内容，略过评论');
        }
    } else {
        praiseMyComment()
    }

    objResult.result = result
    return objResult
}

// 从一个用户主页链接中拿他的文章链接s，并逐条处理
async function startToGetOneUserTuotiaoArticles(url, config = {}) {
    console.log("头条用户开始", url)
    // @see https://www.npmjs.com/package/chrome-extension-async/v/3.4.1
    // const {tabId, changeInfo, tab} = 
    let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
    // let activeTabId = createTabResult.tabId
    let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetArticleUrlsOfOneTuotiaoUser, 'cmd', {})
    // 取到链接了主动关闭tab
    // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
    // First convert the tabId to integer and then pass it to the remove funtion
    // console.log(+activeTabId)
    await chrome.tabs.remove(+activeTabId)
    // chrome.tabs.remove(activeTabId)
    // console.log("user articles executeTabResult", executeTabResult);
    console.log("这个用户有几篇文章", executeTabResult.length)
    for (let j = 0; j < executeTabResult.length; j++) {
        let link = executeTabResult[j]
        console.log("处理文章微头条", link);
        const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, config)
        console.log("文章微头条处理结果", executeArticleTabResult);
        // console.log(+articleTabId)
        await chrome.tabs.remove(+articleTabId)
        await sleep(1000)//处理完一个页面，休息1秒
    }
    console.log("结束了一个用户")
}

// 只返回待处理的文章链接，不处理
async function startToGetOneUserTuotiaoArticles_onlyUrl(url, config = {}) {
    let result = []
    console.log("头条用户开始", url)
    // @see https://www.npmjs.com/package/chrome-extension-async/v/3.4.1
    // const {tabId, changeInfo, tab} = 
    let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
    // let activeTabId = createTabResult.tabId
    let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetArticleUrlsOfOneTuotiaoUser, 'cmd', {})
    // 取到链接了主动关闭tab
    // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
    // First convert the tabId to integer and then pass it to the remove funtion
    // console.log(+activeTabId)
    await sleep(1000)
    await chrome.tabs.remove(+activeTabId)
    // chrome.tabs.remove(activeTabId)
    // console.log("user articles executeTabResult", executeTabResult);
    console.log("这个用户有几篇文章", executeTabResult.length)

    for (let j = 0; j < executeTabResult.length; j++) {
        let link = executeTabResult[j]
        result.push({
            kind: 'article',
            priority: j,
            url: link
        })
        // console.log("处理文章微头条", link);
        // const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        // let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, config)
        // console.log("文章微头条处理结果", executeArticleTabResult);
        // console.log(+articleTabId)
        // await chrome.tabs.remove(+articleTabId)
        // await sleep(1000)//处理完一个页面，休息1秒
    }
    // console.log("结束了一个用户")
    return result
}

// 在我的粉丝列表页，获取已登陆的粉丝主页urls
async function tsGetMyTuotiaoLogonFanList(cmd, options) {
    const sleep = async function (ms) {
        let temple = new Promise(
            (resolve) => {
                console.log("sellep", ms);
                setTimeout(resolve, ms)
            });
        return temple
    }
    await sleep(1000) //是一个ajax加载，先等1秒吧
    let links = []

    // 这个页面是一个无限加载的瀑布流页面，只有中间部分是显示的
    const getCurrentLoginUserList = async function () {
        let logonUserList
        for (let j = 0; j < 3; j++) {
            logonUserList = document.querySelectorAll("div.user-info.login")
            // 处理着屏50个以上
            if (logonUserList.length > 50) {
                break
            } else {
                await sleep(1000)
            }
        }
        for (let j = 0; j < logonUserList.length; j++) {
            let userItem = logonUserList[j]
            if (userItem.querySelector("div.user-follow span").textContent == '关注') {
                //还没回关，关注这个粉丝
                let followBtn = userItem.querySelector("div.user-follow button")
                followBtn.click()
                await sleep(200) // 回关需要时间，暂停200毫秒
            }
            let userLink = userItem.querySelector("a.user-img")
            if (userLink) {
                let link = userLink.href
                if (!links.includes(link)) links.push(link)
            }
        }
    }

    if (cmd == 'all') {
        //取所有粉丝
        // 向上滚动，希望1分钟内可以加载完所有用户列表
        for (let j = 0; j < 60; j++) {
            // 出现了这个div”已加载全部用户“，就不能再滚动了
            if (!document.querySelector("div.common-load-more-footer span div")) {
                await getCurrentLoginUserList()
                console.log("current links", links.length)
                // 一屏大概显示3行，是580个距离，滚多了就会有漏了，全部滚完12655，需要21次大概
                window.scrollBy(0, 580)//向上滚动580，停1秒
                await sleep(1000)
            } else {
                break
            }
        }
    } else if (cmd == 'firstscreen') {
        await getCurrentLoginUserList()
    }

    return links
}

// 获取一个用户的司悟空问答链接
// 同时在悟空用户页，如果发现未关注这个用户，关注他
async function tsGetAnswerUrlsOfOneTuotiaoWukongUser(cmd, options) {
    const sleep = async function (ms) {
        let temple = new Promise(
            (resolve) => {
                console.log("sellep", ms);
                setTimeout(resolve, ms)
            });
        return temple
    }

    await sleep(1000)
    let links = []

    // 如果粉丝大于1000，不管他，跳过吧
    // 最大一个互粉有40分
    // let fansNumItem = document.querySelector("a.user-data-right")
    // if (fansNumItem){
    //     let fansNum = parseInt(fansNumItem.textContent)
    //     if (fansNun > 4200) return links
    // }

    // 先处理关注
    if (window.yyconfig.requireFollowUser) {
        let followUserBtn = document.querySelector("a.w-follow-btn")
        if (followUserBtn && followUserBtn.classList.length == 1) {
            followUserBtn.click()
            await sleep(200)
            let nickName = ''
            let nickNameDiv = document.querySelector("h1.user-name")
            if (nickNameDiv) nickName = nickNameDiv.textContent.replace(' ', '')
            console.log(`关注了新朋友 ${nickName}`);
        }
    }

    let artileItems
    for (let j = 0; j < 3; j++) {
        artileItems = document.querySelectorAll("div.question-v3")
        if (artileItems && artileItems.length > 0) {
            break
        } else {
            await sleep(1000)
        }
    }
    // await sleep(5000)
    // await promises in the tab
    // let artileItems = document.querySelector("li.item[ga_event=feed_item_click]")
    // console.log(artileItems);
    // 这里取了默认一屏的回答
    const maxNumToDealWith = window.yyconfig.maxNumWukongAnswersToDealWith
    let n = Math.min(maxNumToDealWith, artileItems.length)
    for (let j = 0; j < n; j++) {
        let item = artileItems[j]
        // 这里应该取回答链接，而不是问题链接
        let linkItem = item.querySelector("div.answer-item-content a")
        if (linkItem) links.push(linkItem.href)
    }

    // console.log(a, b);
    // 已经执行到这里了
    return links
}

// tab中处理用户回答
async function tsDealWithToutiaoUserWukongAnswer(config) {

    // const MY_TUOTIAO_NAME = '程序员LIYI'
    // 点赞之前，先休息半秒，模块页面加载
    await sleep(1000)
    window.scrollBy(0, 500)//随意滚动一下页面

    let result = []
    window.yyconfig = Object.assign(window.yyconfig, config)

    // 生成一条评论，从池子中选择，或者从已有评论中选一条
    const pickOneComment = async function () {
        // 如果有评论配置，直接返回
        if (window.yyconfig.useOneComment) return window.yyconfig.oneComment

        let comment = ''
        // 如果是转发的内容，有这个标识
        if (document.querySelector("div.original-info")) {
            comment = '赞'
        } else {
            let commentItems = document.querySelectorAll("li.comment-item")
            let diggNum = 0
            for (let commentItem of commentItems) {
                // 
                let diggLink = commentItem.querySelector("a.digg")
                if (diggLink) {
                    // 这个按钮可以重复点
                    diggLink.click()
                    await sleep(200)
                    if (parseInt(diggLink.textContent) > diggNum) {
                        diggNum = parseInt(diggLink.textContent)
                        let userLink = commentItem.querySelector("a.uname")
                        if (userLink && userLink.textContent.replace(/[ \n\r]/g, '') != MY_TUOTIAO_NAME) {
                            let commentContentText = commentItem.querySelector("div.content-text")
                            if (commentContentText) comment = `${commentContentText.textContent}\n+1`
                        }
                    }
                }
            }
            // 如果没有评论，或点赞数没有达到5个，从评论库中选一条
            if (diggNum < 5 || !comment) {
                let n = Math.round(Math.random() * 100) % (GLOBAL_COMMENTS_ARRAY.length - 1)
                comment = GLOBAL_COMMENTS_ARRAY[n] || '好' //"写的真是太好的，先收藏，回头研究下好好"
                if (Math.random() > 0.5) comment = `${comment}\n[赞]`
                if (Math.random() > 0.5) comment = `${comment}\n[666]`
            }
        }

        return comment
    }

    //点赞
    let hasPraiseYet = false
    let answerToolItm = document.querySelector("div.answer-tool")
    if (answerToolItm) {
        let likeLink = answerToolItm.querySelector("div.comment-tool>a.w-like")
        // 如果没点过，点赞
        console.log("likeList", likeLink.classList);

        // 如果点过赞，是三个class，包括active
        if (likeLink.classList.length != 3) {
            // likeLink.classList.add("active")
            likeLink.click()
            result.push('点赞done')
            await sleep(200)
            hasPraiseYet = false
        } else {
            hasPraiseYet = true
        }
    }

    let requireCommentOne = window.yyconfig.useOneComment || !hasPraiseYet
    // 如果没点过赞，也没评论过，评一条
    let commentLink = answerToolItm.querySelector("div.comment-tool>a.show-comment")
    if (requireCommentOne && commentLink) {
        hasCommentOne = true
        commentLink.click()//跳转去评论框
        let commentDiv = document.querySelector("div.comment-area")
        // 自己评过没有?
        if (commentDiv) {
            let commentText = commentDiv.querySelector("textarea")
            // let n = Math.round(Math.random() * 100) % (GLOBAL_COMMENTS_ARRAY.length-1)
            let comment = await pickOneComment()// GLOBAL_COMMENTS_ARRAY[n] //"写的真是太好的，先收藏，回头研究下好好"
            commentText.value = comment
            let evt = document.createEvent('event');
            evt.initEvent('input', true, true);
            commentText.dispatchEvent(evt)
            let commentBtn = commentDiv.querySelector("a.submit-button")
            if (commentBtn) {
                commentBtn.click()
                result.push(`评论done:${comment}`)
                await sleep(200)
            }
        }
    }

    return result
}

// 获取头条用户的悟空问答链接
async function startGetTuotiaoWukongUserAnswers(url, config = {}) {
    console.log("头条用户悟空开始", url)
    let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
    let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetAnswerUrlsOfOneTuotiaoWukongUser, 'cmd', {})
    // 取到链接了主动关闭tab
    // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
    // First convert the tabId to integer and then pass it to the remove funtion
    // console.log(+activeTabId)
    await chrome.tabs.remove(+activeTabId)
    // chrome.tabs.remove(activeTabId)
    // console.log("user articles executeTabResult", executeTabResult);
    console.log("有几篇回答", executeTabResult.length)
    for (let j = 0; j < executeTabResult.length; j++) {
        let link = executeTabResult[j]
        console.log("开始处理回答", link);
        const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        let executeAnswerTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserWukongAnswer, config)
        console.log("问答处理结果", executeAnswerTabResult);
        // console.log(+articleTabId)
        await chrome.tabs.remove(+articleTabId)
        await sleep(1000)//处理完一个页面，休息1秒
    }
    console.log("结束了一个")
}

async function startGetTuotiaoWukongUserAnswers_onlyUrls(url, config = {}, priority) {
    let links = []
    console.log("头条用户悟空开始", url)
    let { tabId: activeTabId } = await chrome.tabs.createAndWait({ url, active: false })
    let executeTabResult = await chrome.tabs.executeAsyncFunction(activeTabId, tsGetAnswerUrlsOfOneTuotiaoWukongUser, 'cmd', {})
    // 取到链接了主动关闭tab
    // 如何关闭tab呢？原方法有权限，是因为参数类型不匹配导致的错误
    // First convert the tabId to integer and then pass it to the remove funtion
    // console.log(+activeTabId)
    await sleep(1000)
    await chrome.tabs.remove(+activeTabId)
    // chrome.tabs.remove(activeTabId)
    // console.log("user articles executeTabResult", executeTabResult);
    console.log("有几篇回答", executeTabResult.length)
    for (let j = 0; j < executeTabResult.length; j++) {
        let link = executeTabResult[j]
        links.push({
            kind: 'wukong',
            url: link,
            priority: j + priority
        })
        // console.log("开始处理回答", link);
        // const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        // let executeAnswerTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserWukongAnswer, config)
        // console.log("问答处理结果", executeAnswerTabResult);
        // console.log(+articleTabId)
        // await sleep(1000)//处理完一个页面，休息1秒
        // await chrome.tabs.remove(+articleTabId)
    }
    console.log("结束了一个")
    return links
}

// 头条：获取登陆的，关注我的粉丝列表
async function tuoTiaoFetchMyLoginFollowerList(scope = 'all') {
    const fanListUrl = 'https://mp.toutiao.com/profile_v3/personal/fan/list'
    let { tabId } = await chrome.tabs.createAndWait({ url: fanListUrl, active: false })
    let logonUserList = await chrome.tabs.executeAsyncFunction(tabId, tsGetMyTuotiaoLogonFanList, scope, {})
    await chrome.tabs.remove(+tabId)
    // 头条链接：https://www.toutiao.com/c/user/93381897376/#mid=1663845773095949
    // 对应的悟空问答链接：https://www.wukong.com/user/?uid=93381897376
    // 两者共享的是同一套粉丝系统，uid是一样的
    await tuotiaoDealWithUsers(logonUserList)
}

// 获取最新的一页文章列表，我的
async function tsGetMyRecentArticleList(cmd, options) {
    //也需要等待，是ajax
    // const sleep = async function (ms) {
    //     let temple = new Promise(
    //         (resolve) => {
    //             console.log("sellep", ms);
    //             setTimeout(resolve, ms)
    //         });
    //     return temple
    // }
    await sleep(1000) //是一个ajax加载，先等1秒吧
    let links = []
    let maxNum = options.maxNum || 3

    // 代码要注掉
    // let nextPageBtn = document.querySelectorAll("span.tui2-pagination-item")
    // if (nextPageBtn && nextPageBtn.length>1) {
    //     nextPageBtn = nextPageBtn[1]
    //     nextPageBtn.click()
    //     await sleep(1000)
    // }

    let artileItems
    for (let j = 0; j < 3; j++) {
        artileItems = document.querySelectorAll("div.article-card")
        if (artileItems && artileItems.length > 0) {
            break
        } else {
            await sleep(1000)
        }
    }

    let n = Math.min(maxNum, artileItems.length)//前三篇，或从参数中取，一天其实写不了三篇文章
    for (let j = 0; j < n; j++) {
        let item = artileItems[j]
        let linkItem = item.querySelector("div.article-card-wrap a")
        if (linkItem) links.push(linkItem.href)
    }

    return links
}

// 从文章评论里查看评论者列表
async function tsFindUserListFromArticleComments(cmd, options) {
    // const sleep = async function (ms) {
    //     let temple = new Promise(
    //         (resolve) => {
    //             console.log("sellep", ms);
    //             setTimeout(resolve, ms)
    //         });
    //     return temple
    // }
    let links = []
    const MY_TUOTIAO_NAME = '程序员LIYI'

    let loadMoreCommentBtn = document.querySelector("a.c-load-more")
    if (loadMoreCommentBtn) loadMoreCommentBtn.click() //只点一次，其它的不管
    await sleep(200)

    let commentItems = document.querySelectorAll("li.c-item")

    if (commentItems.length > 0) {
        for (let j = 0; j < commentItems.length; j++) {
            let commentItem = commentItems[j]
            let praiseBtn = commentItem.querySelector("span[ga_event=click_good_comment]")
            if (praiseBtn) {
                praiseBtn.click()
                await sleep(200)
            }
            let userLink = commentItem.querySelector("a.c-user-name")
            if (userLink && userLink.text != MY_TUOTIAO_NAME) {
                links.push(userLink.href)
            }
        }
    }

    return links
}

// 从文章评论处，查看哪些用户需要回访问
async function tuoTiaoFetchCommentUsersFromArticleComment() {
    // 只取第一页就可以了
    const myRecentArticles = 'https://mp.toutiao.com/profile_v3/graphic/articles'
    let { tabId } = await chrome.tabs.createAndWait({ url: myRecentArticles, active: false })
    let recentArticles = await chrome.tabs.executeAsyncFunction(tabId, tsGetMyRecentArticleList, "cmd", {})
    await chrome.tabs.remove(+tabId)
    await sleep(500)
    console.log("我最新的文章", recentArticles.length)

    for (let j = 0; j < recentArticles.length; j++) {
        let link = recentArticles[j]
        console.log("开始查找文章的评论者", link);
        const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        let findUserListFromArticleCommentResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsFindUserListFromArticleComments, 'cmd', {})
        console.log("评论者列表", findUserListFromArticleCommentResult);//此时拿到了新互动的用户列表
        // console.log(+articleTabId)
        await chrome.tabs.remove(+articleTabId)
        await sleep(1000)//处理完一个页面，休息1秒
        // 开始处理点赞的用户列表
        await tuotiaoDealWithUsers(findUserListFromArticleCommentResult)
    }
}

// 从我的文章查看相关阅读
async function tsFindAboutArticlesFromMyArticle(cmd, options) {
    const sleep = async function (ms) {
        let temple = new Promise(
            (resolve) => {
                console.log("sellep", ms);
                setTimeout(resolve, ms)
            });
        return temple
    }
    await sleep(500)
    let links = []
    const MY_TUOTIAO_NAME = '程序员LIYI'


    // 20篇文章，每篇要保证至少找到50个作者，一共找到1000个新作者关注对象
    // 这个地方，只有第一屏相关推荐的
    let articleItems = document.querySelectorAll("div[ga_event=article_item_click]")
    for (let j = 0; j < 30; j++) {
        if (articleItems.length > 0) break
        // window.scrollBy(0, 2000)
        await sleep(500)
        articleItems = document.querySelectorAll("div[ga_event=article_item_click]")
    }

    if (articleItems.length > 0) {
        for (let j = 0; j < articleItems.length; j++) {
            let item = articleItems[j]
            let articleAuthorItem = item.querySelector("a[ga_event=article_name_click]")
            if (articleAuthorItem && articleAuthorItem.textContent.substr(1, articleAuthorItem.textContent.length - 3) != MY_TUOTIAO_NAME) {
                let linkItem = item.querySelector("div[ga_event=article_title_click] a")
                if (linkItem) {
                    links.push(linkItem.href)
                }
            }
        }
    }

    return links
}

// 处理一个用户
async function tuotiaoDealWithOneUser(link) {
    const tuotiaoHomePageReg = /www\.toutiao\.com\/c\/user\/(\d*?)\//i
    await startToGetOneUserTuotiaoArticles(link)
    await sleep(1000) //完成一个用户文章，休息1秒
    let arr = link.match(tuotiaoHomePageReg)
    if (arr && arr.length > 1) {
        let uid = arr[1]
        // type=0代表是问答，默认是动态
        let wukongHomePageUrl = `https://www.wukong.com/user/?uid=${uid}&type=0`
        await startGetTuotiaoWukongUserAnswers(wukongHomePageUrl)
        await sleep(1000) //完成一个用户的问答，休息1秒
    }
}

// 处理一个用户列表
async function tuotiaoDealWithUsers(logonUserList, config = {}) {
    console.log("开始处理这些粉丝", new Date().toLocaleTimeString(), logonUserList);

    let numCompleted = 0
    const tuotiaoHomePageReg = /www\.toutiao\.com\/c\/user\/(\d*?)\//i
    let links = []
    let wukongStartPriority = 0
    // let articleLinks
    let numTotal = logonUserList.length


    for (let link of logonUserList) {
        numCompleted++
        // 取这个用户待处理的文章
        // await startToGetOneUserTuotiaoArticles(link, config)
        let articleLinks = await startToGetOneUserTuotiaoArticles_onlyUrl(link, config)
        links = links.concat(articleLinks)
        console.log(`${numCompleted} / ${numTotal} articleLinks`, articleLinks)
        wukongStartPriority = articleLinks.length ? articleLinks.length - 1 : 0

        let arr = link.match(tuotiaoHomePageReg)
        if (arr && arr.length > 1) {
            let uid = arr[1]
            // type=0代表是问答，默认是动态
            // 问答
            let wukongHomePageUrl = `https://www.wukong.com/user/?uid=${uid}&type=0`
            // await startGetTuotiaoWukongUserAnswers(wukongHomePageUrl, config)
            let wukongLinks = await startGetTuotiaoWukongUserAnswers_onlyUrls(wukongHomePageUrl, config, wukongStartPriority)
            links = links.concat(wukongLinks)
        }

    }
    links.sort(function (a, b) {
        if (a.priority < b.priority) return -1
        else if (a.priority > b.priority) return 1
        else return 0
    });
    console.log('集中处理sorted links', links);
    let totalNum = links.length

    numCompleted = 0
    for (let j = 0; j < totalNum; j++) {
        let item = links[j]
        console.log("开始处理", item.url);

        if (item.kind == 'article') {
            const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: item.url, active: false })
            let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, config)
            console.log("图文处理结果", executeArticleTabResult);
            await sleep(1000)
            await chrome.tabs.remove(+articleTabId)
        } else if (item.kind == 'wukong') {
            const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: item.url, active: false })
            let executeAnswerTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserWukongAnswer, config)
            console.log("问答处理结果", executeAnswerTabResult);
            await sleep(1000)//处理完一个页面，休息1秒
            await chrome.tabs.remove(+articleTabId)
        }
        numCompleted++
        console.log(`已经处理了：${Math.round(100 * numCompleted / totalNum)}% ${numCompleted}/${totalNum}`, new Date().toLocaleTimeString());
    }

    console.log("这些粉丝处理完了", totalNum, new Date().toLocaleTimeString());
}

// 从我的文章，三篇，的相关文章查找，相关作者，主动关注
async function tuotiaoFromMyArticleToFollowMyArticleAboutArticleAuthors() {
    // 只取第一页就可以了
    const myRecentArticles = 'https://mp.toutiao.com/profile_v3/graphic/articles'
    let { tabId } = await chrome.tabs.createAndWait({ url: myRecentArticles, active: false })
    let recentArticles = await chrome.tabs.executeAsyncFunction(tabId, tsGetMyRecentArticleList, "cmd", { maxNum: 20 })
    await chrome.tabs.remove(+tabId)
    await sleep(500)
    console.log("找到了我的最新文章", new Date().toLocaleTimeString(), recentArticles.length)

    let totalNum = recentArticles.length
    let numCompleted = 0
    let numArticleDealed = 0
    let numHasFollowed = 0

    for (let j = 0; j < recentArticles.length; j++) {
        let link = recentArticles[j]
        console.log("开始查找它的相关推荐", link);
        const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
        let findAboutArticlesResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsFindAboutArticlesFromMyArticle, 'cmd', {})
        console.log("相关推荐列表", findAboutArticlesResult);//此时拿到了相关文章列表
        // console.log(+articleTabId)
        await chrome.tabs.remove(+articleTabId)
        await sleep(1000)//处理完一个页面，休息1秒
        // 开始处理这些文章
        for (let k = 0; k < findAboutArticlesResult.length; k++) {
            let link = findAboutArticlesResult[k]
            console.log("处理文章微头条", link);
            const { tabId: articleTabId } = await chrome.tabs.createAndWait({ url: link, active: false })
            let executeArticleTabResult = await chrome.tabs.executeAsyncFunction(articleTabId, tsDealWithToutiaoUserArticle, 'cmd', {})
            console.log("文章微头条处理结果", executeArticleTabResult.result);
            // console.log(+articleTabId)
            await chrome.tabs.remove(+articleTabId)
            await sleep(1000)//处理完一篇文章，休息1秒
            numArticleDealed++
            // 这篇文章处理了是不够的，还要去他的主页逛一逛
            if (executeArticleTabResult.focus) {
                await tuotiaoDealWithOneUser(executeArticleTabResult.focus)
                numHasFollowed++
            }
        }
        numCompleted++
        console.log(`已经处理了：${numArticleDealed}篇文章，${Math.round(100 * numCompleted / totalNum)}% ${numCompleted}/${totalNum}`, new Date().toLocaleTimeString());
        // 临时限制，200上限
        if (numHasFollowed > 90) break
    }
    console.log("这些文章处理完了", new Date().toLocaleTimeString());
}

// ==========
// chrome.browserAction.onClicked.addListener(function(tab) {
//     // No tabs or host permissions needed!
//     // 单击插件按钮,使用页面背景变成红色
//     console.log('Turning ' + tab.url + ' red!');
//     chrome.tabs.executeScript({
//         code: 'document.body.style.backgroundColor="red"'
//     });
// });

//history
/*
 1,前端工程师的入门与进阶用户推live 2500+ 箐箐,主页增加4000+浏览,90+关注,效果显著 5月1日

 2,如何在计算机校招中脱颖而出 https://www.zhihu.com/lives/838388999964987392
   这次只关注,不说话,1秒关注1个,每次休息1分钟,始于关注者114->144

 3,前端开源项目实战 https://www.zhihu.com/lives/834763168378130432
    0.5秒关注,0.5秒休息,144->151

 4,干货类文章的 3 个写作框架 https://www.zhihu.com/lives/822817269108346880
   151->164 止于1590
 https://www.zhihu.com/api/v4/members/zhou-chao-91-99/followers
 {"error": {"message": "\u60a8\u5173\u6ce8\u7684\u4eba\u6570\u5df2\u8fbe\u4e0a\u9650\uff0c\u8bf7\u53d6\u6d88\u4e00\u4e9b\u5173\u6ce8", "code": 4000, "name": "UnproccessableException"}}
 您关注的人数已达上限，请取消一些关注,5000人
 如果能取 $(".FollowStatus") 代表是相互关注,
 以上是小箐帐号

 小程序、RN、Weex 漫谈
 https://www.zhihu.com/lives/804799728364703744
 阿朱:2->0 400,看来小程序很冷

 美国就业：技术设计求职攻略
 https://www.zhihu.com/lives/832962089990627328
 */

var totalComplete = 0;
var SEND_INTERNAL = 5; //秒
var SLEEP_TIME = 20;//分
var LIVE_MEMEBER_NUM = 157;
var LIVE_MEMEBER_ONCEGET_LIMIT = 20;
var LIVE_NAME = "";

//要处理的参数列表
var GLOBAL_MEMBER_ARGS = [];

/*
 838388999964987392
 834763168378130432
 822817269108346880
 804799728364703744
 832962089990627328
 "839855090830544897"
 ,"831498137100242944"

 "839850857922191360"
 ,"828242418028642304"
 ,"841289257443274752"
 ,"839864761947652096"
 ,"830734336872550400"
 826129882722504704
 ,"842680296339030016"
 ,"839859178712465408"
 ,"823241132099129344"
 ,"802862415313240064"
 ,"738178990451212288"
 */

// liveid列表,小关注或许才是真爱
var LIVE_IDS = [
    "846025138657964032"
    , "773835323196063744"
    , "772099611425779712"

];
var LIVE_MEMEBER_OFFSET = 320;
var LIVE_ID = "";
//这两个参数从界面中读取
var ROBOT_NAME = "小箐";

//处理下一个liveid
function gotoNextLive(offset) {
    if (LIVE_IDS.length == 0) return;
    LIVE_ID = LIVE_IDS.pop();
    LIVE_MEMEBER_OFFSET = offset || 0;
    totalComplete = 0;
    console.log("STAR liveid--", LIVE_ID);
    getLiveInfo();
}

console.log("STARTED-------------------");

var ZHIHU_DOMAIN_ID = "liyi2005";//知乎帐号id

var PAGE_FOLLOWING_OPENED = 0
// 开始减关
function startJianGuan() {
    //UserLink-link
    QUGUAN_PAGE_OFFSET = 0
    jianGuan1Step()
}
// 打开个人关注人的主页
function jianGuan1Step(arg) {
    var page = 1 + Math.floor(QUGUAN_PAGE_OFFSET / 20)
    console.log("jianGuan1Step,page:", page)
    // 该页面可以重复打开,直到所有关注者处理完
    var url = "https://www.zhihu.com/people/" + ZHIHU_DOMAIN_ID + "/following?page=" + page;
    chrome.tabs.create({ url: url, active: false }, function (tab) {
        var tabId = tab.id;
        chrome.tabs.executeScript(tabId, { file: "jianguan1.js" }, function () { });
    });
    //chrome.runtime.sendMessage({"usersened":true,url:url});
    PAGE_FOLLOWING_OPENED++;
    console.log(PAGE_FOLLOWING_OPENED, "次页已打开");
}
var JIANGUAN_BTNS_CACHE = [];
var QUGUAN_PAGE_OFFSET = 0
// 处理减关第一步得到的btns集合
function dealWithJianGuanBtns(btns) {
    if (QUGUAN_PAGE_OFFSET % 20 > 0) {
        var offset = QUGUAN_PAGE_OFFSET % 20
        btns = btns.slice(offset)
    }

    if (btns.length == 0) {
        console.log("所有人减关处理完了?");
        return
    }

    JIANGUAN_BTNS_CACHE = btns;
    jianguanOpenOneTab();
}
function jianguanOpenOneTab() {
    if (JIANGUAN_BTNS_CACHE.length == 0) {
        console.log("这一批处理完了?");
        jianGuan1Step();
        return
    }
    // console.log("JIANGUAN_BTNS_CACHE",JIANGUAN_BTNS_CACHE)
    var link = JIANGUAN_BTNS_CACHE.shift();
    console.log("JIANGUAN_BTNS_CACHE n", JIANGUAN_BTNS_CACHE.length, link)
    link += "/activities"
    chrome.tabs.create({ url: link, active: false }, function (tab) {
        var tabId = tab.id;
        chrome.tabs.executeScript(tabId, { file: "jianguan2.js" }, function () { });
    });
}

// chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {

//     let kind = msg.kind
//     switch (kind) {
//         case 'getUserTuotiaoArticleLinksResult': {
//             var links = msg.links;
//             console.log("links", links)
//             break
//         }
//         case "textInBg2":{
//             sendResponse('back from bg', msg)
//             break
//         }
//         default:
//         //
//     }

// if (msg.unfollowcomplete) {
//     console.log("完成了一个取关")

//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);
//     var followme = msg.followme
//     if (followme) {
//         QUGUAN_PAGE_OFFSET++
//     }

//     jianguanOpenOneTab();
// } else if (msg.getfollowbtns) {
//     var btns = msg.btns;
//     console.log(msg.btns)

//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);

//     // dealWithJianGuanBtns(btns);
// } else if (msg.jianguan_start) {
//     startJianGuan();
// } else if (msg.startgetarg) {
//     var arg = msg.arg;
//     // console.log("arg",arg,arg.liveid != "");
//     if (arg.liveid != "") LIVE_ID = arg.liveid;
//     if (arg.rname != "") ROBOT_NAME = arg.rname;
//     if (arg.offset > 0) LIVE_MEMEBER_OFFSET = parseInt(arg.offset);
//     totalComplete += LIVE_MEMEBER_OFFSET;

//     console.log("LIVE_ID:\t", LIVE_ID);
//     console.log("ROBOT_NAME:\t", ROBOT_NAME);
//     console.log("LIVE_MEMEBER_OFFSET:\t", LIVE_MEMEBER_OFFSET);
//     console.log("Let's Go..");

//     gotoNextLive(LIVE_MEMEBER_OFFSET);

// } else if (msg.nexttab) {
//     //刚完成一个发送
//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);//关闭完成发送的窗口
//     console.log("close tab:", tab.id);

//     //正常打开发送,一个页面2.5秒,人工手动发送正常需要8-10
//     //大概发到500,被反作弊系统发现,封号
//     //待尝试:一次只发200,每次用时delay3.5秒,合6秒,计1小时发完
//     //4800需1天才能发完
//     //完成了一个,处理下一个tab
//     setTimeout(function () {
//         openTabList();
//     }, SEND_INTERNAL * 1000);
// } else if (msg.next) {
//     //刚完成一个发送
//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);//关闭完成发送的窗口
//     console.log("close tab:", tab.id);
//     console.log("发生错误:", msg.res);

//     openTabList();
// } else if (msg.sleepwork) {
//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);//关闭完成发送的窗口
//     console.log("close tab:", tab.id);

//     console.log("last res:", msg.res);

//     console.log("服务器命令我休息,休息" + SLEEP_TIME + "分钟..");
//     console.log("SEND_INTERNAL:\t", SEND_INTERNAL + "秒");
//     console.log("SLEEP_TIME:\t", SLEEP_TIME + "分");
//     console.log("LIVE_MEMEBER_OFFSET:\t", LIVE_MEMEBER_OFFSET);
//     console.log("COMPLETE:\t", LIVE_MEMEBER_OFFSET + totalComplete);

//     //发送失败的稍后重试
//     var arg = msg.arg;
//     GLOBAL_MEMBER_ARGS.unshift(arg);

//     var sleepTime = SLEEP_TIME;
//     var secondsDelay = 0;
//     var delayInternal = setInterval(function () {
//         secondsDelay += 15;
//         console.log(secondsDelay, "SECONDS DELAY,REMAIN:", (sleepTime * 60 - secondsDelay));
//     }, 1000 * 15);//每15秒提示一次

//     setTimeout(function () {
//         clearInterval(delayInternal);
//         openTabList();
//     }, sleepTime * 60 * 1000);

//     //每让休息一次,间隔时间增加一秒
//     // SEND_INTERNAL++
//     //每让休息一次,下次多休息1分钟
//     SLEEP_TIME++
// } else if (msg.getarg) {
//     //在content中发出了取参数的需求
//     if (msg.name == "SLEEP_TIME") {
//         if (sendResponse) sendResponse(SLEEP_TIME);
//     }
// } else if (msg.startyoudaolike) {
//     var ydid = msg.arg.ydid
//     var ydnum = msg.arg.ydnum
//     console.log(ydid)
//     YOUDAO_ARTICLE_ID = ydid
//     YOUDAO_LIKE_NUM = parseInt(ydnum)
//     console.log('ID', ydid)
//     console.log('NUM', ydnum)
//     youdaoOpenOneTab()
//     youdaoOpenOneTab()
// } else if (msg.closeyoudaopage) {
//     var tab = sender.tab;
//     if (tab) chrome.tabs.remove(tab.id);
//     youdaoOpenOneTab();
// }
// });

var YOUDAO_ARTICLE_ID = ''
var YOUDAO_LIKE_NUM = 0

function youdaoOpenOneTab() {
    YOUDAO_LIKE_NUM--
    console.log('进度', YOUDAO_LIKE_NUM)
    if (YOUDAO_LIKE_NUM < 0) return

    var link = "https://note.youdao.com/share/?type=note&id=" + YOUDAO_ARTICLE_ID
    chrome.tabs.create({ url: link, active: false }, function (tab) {
        var tabId = tab.id;
        try {
            chrome.tabs.executeScript(tabId, { file: "youdaolike.js" }, function () { });
        } catch (error) {
            //可能会出现tab已被关闭的异常
        }

    });
}

// 监听tab打开
// chrome.tabs.onCreated.addListener(function(tab) {
//     var tabId = tab.id;
//     renderStatus('opened tab:'+tabId);
// });

// 实现打开一个tab
function openOneTab(arg) {
    // console.log("openOnetab",arg);
    // arg不知为何为null
    // if (!arg || !arg.urltoken){
    //     openTabList();
    //     return
    // }
    var url = "https://www.zhihu.com/people/" + arg.urltoken + "/answers?id=" + arg.id + "&urltoken=" + arg.urltoken + "&name=" + arg.name + "&rname=" + ROBOT_NAME;
    chrome.tabs.create({ url: url, active: false }, function (tab) {
        var tabId = tab.id;
        // renderStatus('tabId'+tabId);
        // postZhihuMessage();
        // chrome.tabs.remove(tabId);这里直接就会关闭
        // chrome.tabs.executeScript(tabId, {code: "var ROBOT_NAME = "+ROBOT_NAME,runAt:"document_start"});
        chrome.tabs.executeScript(tabId, { file: "content.js" }, function () { });
    });
    //chrome.runtime.sendMessage({"usersened":true,url:url});
    totalComplete++;
    console.log(totalComplete, "用户[" + arg.name + "]已完成");
}

// 依次打开tab
function openTabList() {
    // renderStatus('GLOBAL_MEMBER_ARGS.length:'+GLOBAL_MEMBER_ARGS.length);
    if (GLOBAL_MEMBER_ARGS.length == 0) {
        renderStatus('PATCH DONE LIVE_MEMEBER_OFFSET:' + LIVE_MEMEBER_OFFSET);
        renderStatus('LIVE_MEMEBER_NUM:' + LIVE_MEMEBER_NUM);
        renderStatus('LIVE_ID:' + LIVE_ID);

        if (LIVE_MEMEBER_OFFSET >= LIVE_MEMEBER_NUM) {
            renderStatus('ALL DONE:' + LIVE_MEMEBER_NUM, "go go next..");
            gotoNextLive();
            return
        } else {
            //每发送limit(20)条,主动休息一下
            console.log("休息一下,稍后拉取参数,时间:", SLEEP_TIME, "目前时间:", new Date());
            setTimeout(function () {
                getArgList();
            }, SLEEP_TIME * 60 * 1000);
        }
        //此时未返回,造成死循环
        return
    }
    var arg = GLOBAL_MEMBER_ARGS.shift();
    openOneTab(arg);
}

//先取出live消息,获知共有多少member,ok
function getLiveInfo() {
    var x = new XMLHttpRequest();//4880
    x.open('get', "https://www.rixingyike.com/opt/zhihu.live.getmemberinfo/" + LIVE_ID, true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader('content-type', 'application/json');
    x.onload = function () {
        // Parse and process the response from Google Image Search.
        if (x.status == 200) {
            var results = JSON.parse(x.responseText);
            LIVE_MEMEBER_NUM = results.seat_taken;
            LIVE_NAME = results.subject;
            console.log(LIVE_NAME, LIVE_MEMEBER_NUM + "人关注");
            getArgList();
        }
    };
    x.send();
}

//取出参数列表,准备依次打开,ok
function getArgList() {
    var x = new XMLHttpRequest();//4880
    var targetUrl = "https://www.rixingyike.com/opt/zhihu.live.members?limit=" + LIVE_MEMEBER_ONCEGET_LIMIT + "&offset=" + LIVE_MEMEBER_OFFSET + "&id=" + LIVE_ID;
    console.log("getArgList url:", targetUrl);
    x.open('get', targetUrl, true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader('content-type', 'application/json');
    x.onload = function () {
        // Parse and process the response from Google Image Search.
        // var response = x.responseText;
        // renderStatus('len:'+x.status+","+x.readyState);
        if (x.status == 200) {
            var results = JSON.parse(x.responseText);
            // renderStatus('len:'+results.length);10
            //此处判断取得的数量,避免进入死循环
            renderStatus('results.length:' + results.length);
            if (results.length > 0) {
                LIVE_MEMEBER_OFFSET += results.length;//累加偏移量
                GLOBAL_MEMBER_ARGS = results;
                openTabList();
            } else {
                console.log("result empty, all done? go to next..");
                gotoNextLive();
            }
        }
    };
    x.send();
}

function renderStatus(statusText) {
    console.log(statusText);
}