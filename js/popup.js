import service from './service.js'

window.onpageshow = function(){
    // this.alert('hi popup')
    // 自动存动粉丝偏移量，按量操作
    let offset = 0
    let fansOffsetKey = new Date().toLocaleDateString()
    let fansOffsetObj = window.localStorage.getItem("fans_offset")
    if (fansOffsetObj){
        fansOffsetObj = JSON.parse(fansOffsetObj)
    }else{
        fansOffsetObj = {date:fansOffsetKey,offset:0}
    }
    if (fansOffsetKey == fansOffsetObj.date) offset = fansOffsetObj.offset
    $(`#toutiao_fans_num_offset`).val(offset)
    console.log("fansOffsetObj",fansOffsetObj);
}

// 增加偏移量
function plusFansDealWithOffset(newOffset){
    let fansOffsetKey = new Date().toLocaleDateString()
    let fansOffsetObj = window.localStorage.getItem("fans_offset")
    if (!fansOffsetObj){
        fansOffsetObj = {date:fansOffsetKey,offset:0}
    }else{
        fansOffsetObj = JSON.parse(fansOffsetObj)
    }
    if (fansOffsetKey == fansOffsetObj.date){
        fansOffsetObj.offset += newOffset
    }else{
        fansOffsetObj.offset = 0
        fansOffsetObj.date = fansOffsetKey
    }
    console.log("fansOffsetObj",fansOffsetObj);
    
    window.localStorage.setItem("fans_offset", JSON.stringify(fansOffsetObj))
}

// 在对popup页面审查元素的时候popup会被强制打开无法关闭
function showMessageTip(msg){
    $("#msgtip").text(msg)
}

// 发消息给bg
function sendMessageToBackgroundFromPopup(cmd, options) {
    const p = new Promise(
        async (resolve, reject) => {
            let res = await chrome.runtime.sendMessage({cmd,options})
            console.log("res",res);
            // resolve(res)
        })
    return p
}

// 通过tabs，从popup向content-script发送消息
// cs是当前的活动页，如果要先查找
// 在空的tab页是不可以测试插件的
function sendMessageToContentScriptFromPopup(cmd, options) {
    const p = new Promise(
        async resolve => {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];
            const response = await chrome.tabs.sendMessage(activeTab.id, {cmd,options})
            resolve(response)
        })
    return p
}
// 新头条操作：拉新
$(`#toutiaoFetchNewUsers
`).bind('click', async e=>{
    // console.log(e.currentTarget.id, e.currentTarget.dataset.source);
    // wukongHome/wukongRank/all
    let source = e.currentTarget.dataset.source
    let search = e.currentTarget.dataset.search || 'wukong'
    let useWukongSearch = search == 'wukong'
    await sendMessageToBackgroundFromPopup(e.currentTarget.id,{source,useWukongSearch})
})
// 拉取db中有多少待关注人数，state=0
$(`#toutiaoFetchNumNewUsersInDB
`).bind('click', async e=>{
    let res = await service.toutiao.getNumOfWillFollowUsers()
    if (res.code){
        let num = res.data
        $("#toutiaoFetchNumNewUsersInDB").text(num)
        $("#fetch_toutiao_users_num").val(Math.min(num,200))
    }
})
// 单击今天额度已用数
$(`#toutiaoFetchNumLastFollowToday
`).bind('click', async e=>{
    let res = await service.toutiao.getNumLastFollowToday()
    if (res.code){
        let num = res.data
        $("#toutiaoFetchNumLastFollowToday").text(num)
        $("#fetch_toutiao_users_num").val(200-num)
    }
})
// 维护粉丝
$(`#toutiaoVisitNewFollers
`).bind('click', async e=>{
    let source = e.currentTarget.dataset.source || ''
    let offset = parseInt($(`#toutiao_fans_num_offset`).val())
    let maxnum = parseInt($(`#toutiao_fans_maxnum`).val())
    plusFansDealWithOffset(maxnum)
    await sendMessageToBackgroundFromPopup(e.currentTarget.id,{source,offset,maxnum})
})
// 维新 
$(`#opt_tuotiao_sendmessageto_unfollowme
    ,#opt_current_fans_page_toutiao_normal
`).bind('click', async e=>{
    // console.log(e.currentTarget.id, e.currentTarget.dataset.source);
    // wukongHome/wukongRank/all
    let source = e.currentTarget.dataset.source || ''
    let offset = parseInt($(`#toutiao_fans_num_offset`).val())
    let maxnum = parseInt($(`#toutiao_fans_maxnum`).val())
    await sendMessageToBackgroundFromPopup(e.currentTarget.id,{source,offset,maxnum})
})

$(`#toutiaoFollowUserFromDb,
    #followMyFansAndSaveToDB
`).bind('click', async e=>{
    let num = parseInt($(`#fetch_toutiao_users_num`).val())
    await sendMessageToBackgroundFromPopup(e.currentTarget.id,{num})
})

// $(`#followMyFansAndSaveToDB
// `).bind('click', async e=>{
//     let num = parseInt($(`#fetch_toutiao_users_num`).val())
//     await sendMessageToBackgroundFromPopup(e.currentTarget.id,{num})
// })

// 头条
$(`#opt_noreplayfollow_but_praiseandcomment_toutiao
    ,#opt_current_fans_page_toutiao_normal
    ,#opt_onlyreplayfollow_toutiao
    ,#opt_current_fans_page_toutiao_normal
    ,#opt_current_fans_page_toutiao
    ,#from_my_article_to_follow_authors
    ,#praise_and_comment_from_user_article_comments
    ,#open_firstscreen_tuotiao_article_and_comment
    ,#open_all_tuotiao_article_and_comment
    ,#opt_tuotiao_sendmessageto_unfollowme
    ,#opt_tuotiao_pcff_from_curren_article
    ,#opt_tuotiao_followuser_from_current_article
`).bind('click', e=>{
    let bg = chrome.extension.getBackgroundPage();
    // let bg2 = chrome.runtime.getBackgroundPage()
    // console.log(bg,bg2);
    bg.startTuotiaoActivity(e.currentTarget.id);
    // alert(e.currentTarget.id)
})

// 测试
$('#testInBg').click(async e => {
    // 使用module之后，没有办法直接取得bg对象了
    // let bg = chrome.extension.getBackgroundPage();
    // let bg2 = await chrome.runtime.getBackgroundPage()//module这是一个异步模块
    // console.log(bg,bg.startTuotiaoActivity,bg2,bg2.startTuotiaoActivity);
    // console.log("e.currentTarget.id",e.currentTarget.id);
    // for (let n in bg) {
    //     console.log(n,bg[n]);
    // }
    console.log(e.currentTarget.id);
    let res = await sendMessageToBackgroundFromPopup('textInBg2',{})
    console.log("res", res);
    
    // let bg = chrome.extension.getBackgroundPage();
    // bg.startTuotiaoActivity(e.currentTarget.id);
});
$('#testSendMessageToCS').click(async (e) => {
    let res = await sendMessageToContentScriptFromPopup('toolset',{opt:'none'});
    console.log('来自cs的回复123：' + res);
});

// 工具
$(`#opt_clear_storage
    ,#opt_scrolltop_start
    ,#opt_scrolltop_end
`).bind('click', async e=>{
    let res = await sendMessageToContentScriptFromPopup('toolset',{opt:e.currentTarget.id});
    showMessageTip(`${e.currentTarget.id}：${res}`)
})

document.addEventListener('DOMContentLoaded', function () {

    // var startbtn = document.getElementById('startbtn');
    // startbtn.addEventListener('click', function () {
    //     // openOneTab("https://www.zhihu.com/people/mumubody/activities");
    //     // getArgList();
    //     var liveid = document.getElementById('liveid_input').value;
    //     var rname = document.getElementById('rname_input').value;
    //     var offset = document.getElementById('offset_input').value;
    //     rname = decodeURIComponent(rname);
    //     renderStatus("arg:" + liveid + "," + rname);
    //     chrome.runtime.sendMessage({ "startgetarg": true, arg: { liveid: liveid, rname: rname, offset: offset } });
    // });

    // // 减关
    // var jianguan_btn = document.getElementById('jianguan_btn');
    // jianguan_btn.addEventListener('click', function () {
    //     chrome.runtime.sendMessage({ "jianguan_start": true });
    // });

    // // 有道加喜欢
    // var jianguan_btn = document.getElementById('yd_btn');
    // jianguan_btn.addEventListener('click', function () {
    //     var ydid = document.getElementById('ydid_input').value;
    //     var ydnum = document.getElementById('ydnum_input').value;
    //     chrome.runtime.sendMessage({ "startyoudaolike": true, arg: { ydid: ydid, ydnum: ydnum } });
    // });
});

// =======================

function renderStatus(statusText) {
    document.getElementById('status').textContent = statusText;
}

//oks
function postMyHiPage() {
    var x = new XMLHttpRequest();
    x.open('POST', "https://www.rixingyike.com/hi", true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader('content-type', 'application/json');
    x.onload = function () {
        // Parse and process the response from Google Image Search.
        var response = x.responseText;
        if (x.readyState == 4 && x.status == 200) {
            renderStatus('postZhihuMessage:' + response);
        }
        // 因为使用代理,可能走到线上,反加status=404
        // renderStatus('loadMyHiPage:'+x.readyState+","+x.status);
    };
    var data = { lorem: "ipsum", id: 1 };
    // //将用户输入值序列化成字符串
    x.send(JSON.stringify(data));
}

// ok
function loadMyHiPage() {
    var x = new XMLHttpRequest();
    x.open('POST', "https://www.rixingyike.com/hi", true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    x.onload = function () {
        // Parse and process the response from Google Image Search.
        var response = x.responseText;
        if (x.readyState == 4 && x.status == 200) {
            renderStatus('loadMyHiPage:' + response);
        }
        // 因为使用代理,可能走到线上,反加status=404
        // renderStatus('loadMyHiPage:'+x.readyState+","+x.status);
    };
    var params = "lorem=ipsum&name=binny";
    x.send(params);
}

// ok,可以跨域发送了
function postZhihuMessage() {
    var x = new XMLHttpRequest();
    x.open('POST', "https://www.zhihu.com/api/v4/messages", true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader('content-type', 'application/json');
    x.setRequestHeader('x-udid', 'AHACu-ubOguPTiG_7jw28lC5vBd4HSCcbj4=');
    x.setRequestHeader('Host', 'www.zhihu.com');
    x.setRequestHeader('Origin', 'https://www.zhihu.com');
    x.setRequestHeader('Referer', 'https://www.zhihu.com/people/mumubody/activities');
    x.setRequestHeader('Cookie', 'd_c0="AHACu-ubOguPTiG_7jw28lC5vBd4HSCcbj4=|1485691748"; _zap=58726855-1c3f-46e2-ac53-059338eccb8d; _xsrf=21902ff1725c38eba9bcdf25a06b86e6; q_c1=e6a6631315ff4c6e9fda7ff4a6f94637|1491407250000|1485691731000; r_cap_id="OWE2OThiN2I5YWVhNDYyNWI2NmE5YTBlM2FlMzMwMGU=|1491410289|c6902a22822208fa8e7efb097e8c0ee1ee5b9c80"; cap_id="YjI5NzYxMjE3YWYwNGMyYjg0OTQ1OWM0NDNiZmJhYzY=|1491410289|48fcbe1b028ac5b84f8eac3904406a38b7920b87"; l_cap_id="NzE1ZjNhZTM3MGQ0NDFhYThjOTM5NzRiOWUwNDBiOGY=|1491410289|4c72d58c46aee93f302190fc8fd871e9d469069a"; aliyungf_tc=AQAAAGUHTiKiuQkAjQtFeaHGxJ+sx7A5; acw_tc=AQAAAAB9CR31HggAtDLPfBYQKcCg6Mll; __utma=51854390.249588683.1491542857.1492527075.1492704848.8; __utmb=51854390.0.10.1492704848; __utmc=51854390; __utmz=51854390.1492444762.6.4.utmcsr=zhihu.com|utmccn=(referral)|utmcmd=referral|utmcct=/people/ben-pao-de-gong-niu-75/activities; __utmv=51854390.100--|2=registration_date=20170129=1^3=entry_date=20170129=1; z_c0=Mi4wQUREQ2NnU2NPZ3NBY0FLNzY1czZDeGNBQUFCaEFsVk5pS29NV1FCWE1VclJ3OW4wbVQ5WFhsejh4anprSnctS1l3|1492704847|b4e1550d690c2b62482c1f726843daa149f91235');

    x.onload = function () {
        // Parse and process the response from Google Image Search.
        var response = x.responseText;
        if (x.readyState == 4 && x.status == 200) {
            renderStatus('ok');
        } else {
            renderStatus('not ok:' + x.status);
        }
        // 因为使用代理,可能走到线上,反加status=404
        // renderStatus('loadMyHiPage:'+x.readyState+","+x.status);
    };
    var data = { content: "hi", receiver_hash: "6dbf313fcef7809f19d0665db0a137be", type: "common" };
    // //将用户输入值序列化成字符串
    x.send(JSON.stringify(data));
}

