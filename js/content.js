/**
 * Created by sban on 2017/4/21.
 */

// 只是点赞,首答小于10,点赞,关注,不发信
function focusTaOnFirstAnswerOk(id,urltoken,name,rname) {
    // 首答小于10,关注他
    var firstAnswerIsOk = false;
    var sendedMsg = false;

    var btns = document.getElementsByClassName("VoteButton--up");
    if (btns.length > 0){
        var btn = btns[0];
        if (parseInt(btn.innerText) < 30){
            firstAnswerIsOk = true
            btn.click();
        }
    }

    if (firstAnswerIsOk) {//关注这个用户,并发私信
        var btns = document.getElementsByClassName("FollowButton");
        if (btns.length > 0){
            var btn = btns[0];
            // 未关注时,关注
            if (btn.innerText != "已关注"){
                btn.click();
            }
        }
    }

    setTimeout(function () {
        chrome.runtime.sendMessage({"nexttab":true});
    },3000);
}


// 先点赞首答,停1.5秒,关注,停1.5秒,发信
function focusTaAndSendMessageOnFirstAnswerOk(id,urltoken,name,rname) {
    // 首答大于5,关注他
    var firstAnswerIsOk = false;
    var sendedMsg = false;

    var btns = document.getElementsByClassName("VoteButton--up");
    if (btns.length > 0){
        var btn = btns[0];
        var praiseNum = parseInt(btn.innerText)
        if (praiseNum < 30 && praiseNum > 0){
            firstAnswerIsOk = true
        }
    }

    if (firstAnswerIsOk) {//关注这个用户,并发私信
        var btns = document.getElementsByClassName("FollowButton");
        if (btns.length > 0){
            var btn = btns[0];
            // 未关注时,关注
            if (btn.innerText != "已关注"){
                btn.click();
                //发信自带关闭tab
                setTimeout(function () {
                    postZhihuMessage(id,urltoken,name,rname)
                },2000);
                sendedMsg = true
            }
        }
    }

    if (!sendedMsg){
        setTimeout(function () {
            chrome.runtime.sendMessage({"nexttab":true});
        },1500);
    }
}

// 先点赞首答,停1秒,关注,再关闭
function praiseFirstAnswerAndFollow() {
    praiseUserFirstAnswer();
    setTimeout(function () {
        onlyfollowUser();
    },1000);
}

// 为用户主页的第一个回答点赞
function praiseUserFirstAnswer() {
    var btns = document.getElementsByClassName("VoteButton--up");
    if (btns.length > 0){
        var btn = btns[0];
        if (parseInt(btn.innerText) < 10){
            // 如果首答点赞小于10,
            // 如果未点赞过,点之
            if (btn.className.indexOf("is-active") < 0){
                btn.click();
            }
        }
    }
}

function closeThisTab(secondsAfter) {
    // if (undefined == secondsAfter) secondsAfter = 1
    secondsAfter = secondsAfter || 1;
    setTimeout(function () {
        chrome.runtime.sendMessage({"nexttab":true});
    },secondsAfter*1000);
}

//取消关注这个用户
function unfollowThisUser() {
    var btns = document.getElementsByClassName("FollowButton");
    if (btns.length > 0){
        var btn = btns[0];
        // 未关注时,关注
        if (btn.innerText == "已关注"){
            btn.click();
        }
    }
}

//关注这个用户
function followThisUser() {
    var btns = document.getElementsByClassName("FollowButton");
    if (btns.length > 0){
        var btn = btns[0];
        // 未关注时,关注
        if (btn.innerText != "已关注"){
            btn.click();
        }
    }
}

function onlyfollowUser() {
    followThisUser();
    setTimeout(function () {
        chrome.runtime.sendMessage({"nexttab":true});
    },1000);
}

function postZhihuMessage(id,urltoken,name,robotName) {
    // id = "6dbf313fcef7809f19d0665db0a137be"
    // urltoken = "mumubody"
    // name = "木木"

    var udid = btoa(id)
    udid = udid.substr(0,36)

    var x = new XMLHttpRequest();
    x.open('POST', "https://www.zhihu.com/api/v4/messages", true);
    // The Google image search API responds with JSON, so let Chrome parse it.
    x.setRequestHeader('content-type', 'application/json');
    x.setRequestHeader('x-udid', udid);

    //这此设置是无用的,浏览器不允许
    x.setRequestHeader('Host', 'www.zhihu.com');
    x.setRequestHeader('Origin', 'https://www.zhihu.com');
    x.setRequestHeader('Referer', 'https://www.zhihu.com/people/'+urltoken+'/activities');
    // x.setRequestHeader('Cookie', 'd_c0="AHACu-ubOguPTiG_7jw28lC5vBd4HSCcbj4=|1485691748"; _zap=58726855-1c3f-46e2-ac53-059338eccb8d; _xsrf=21902ff1725c38eba9bcdf25a06b86e6; q_c1=e6a6631315ff4c6e9fda7ff4a6f94637|1491407250000|1485691731000; r_cap_id="OWE2OThiN2I5YWVhNDYyNWI2NmE5YTBlM2FlMzMwMGU=|1491410289|c6902a22822208fa8e7efb097e8c0ee1ee5b9c80"; cap_id="YjI5NzYxMjE3YWYwNGMyYjg0OTQ1OWM0NDNiZmJhYzY=|1491410289|48fcbe1b028ac5b84f8eac3904406a38b7920b87"; l_cap_id="NzE1ZjNhZTM3MGQ0NDFhYThjOTM5NzRiOWUwNDBiOGY=|1491410289|4c72d58c46aee93f302190fc8fd871e9d469069a"; aliyungf_tc=AQAAAGUHTiKiuQkAjQtFeaHGxJ+sx7A5; acw_tc=AQAAAAB9CR31HggAtDLPfBYQKcCg6Mll; __utma=51854390.249588683.1491542857.1492527075.1492704848.8; __utmb=51854390.0.10.1492704848; __utmc=51854390; __utmz=51854390.1492444762.6.4.utmcsr=zhihu.com|utmccn=(referral)|utmcmd=referral|utmcct=/people/ben-pao-de-gong-niu-75/activities; __utmv=51854390.100--|2=registration_date=20170129=1^3=entry_date=20170129=1; z_c0=Mi4wQUREQ2NnU2NPZ3NBY0FLNzY1czZDeGNBQUFCaEFsVk5pS29NV1FCWE1VclJ3OW4wbVQ5WFhsejh4anprSnctS1l3|1492704847|b4e1550d690c2b62482c1f726843daa149f91235');

    x.onload = function() {
        // Parse and process the response from Google Image Search.
        var response = x.responseText;
        if(x.readyState == 4 && x.status == 200) {
            console.log('ok');
            chrome.runtime.sendMessage({"nexttab":true});
        }else if(x.status == 403){
            //刚发了12个就让休息

            //服务器返回403
            // {"error": {"message": "\u53d1\u9001\u79c1\u4fe1\u592a\u5feb\uff0c\u4f11\u606f\u4f1a\u513f\u518d\u8bd5\u5427~\u6709\u7591\u95ee\u8bf7\u8054\u7cfb\uff1aantispam@zhihu.com", "code": 106, "name": "SpamRequestException"}}
            // 发送太快,服务器要求休息一会
            console.log('not ok:'+x.status);
            chrome.runtime.sendMessage({"sleepwork":true,arg:{id:id,urltoken:urltoken,name:name},res:response});
            // 过一段时间如果页面关闭,消息是发不出去的
            // chrome.runtime.sendMessage({"getarg":true,"name":"SLEEP_TIME"},function (sleepTime) {
            //     setTimeout(function () {
            //         chrome.runtime.sendMessage({"nexttab":true});
            //     },60*1000*sleepTime);
            //     chrome.runtime.sendMessage({"sleepwork":true,time:sleepTime});
            // });
        }else{
            chrome.runtime.sendMessage({"next":true,res:response});
        }
    };
    var globald = new Date();
    var globaltodayTxt = formatDate(globald,"S萌萌达~~~")

    var textContent = name+",献给你我今天的第一个赞~\n我是"+robotName+",想请教一下,这场知乎live你觉得值得参加吗?\n" +
        "零编程打造一款私人智能助理\nhttps://www.zhihu.com/lives/846360223609413632\n冒昧发信,如果打扰到您,请您原谅~";
    // 只发一个简单的hi
    // textContent = "hi~";
    var data = {content:textContent,receiver_hash:id,type:"common"};
    // //将用户输入值序列化成字符串
    x.send(JSON.stringify(data));
}

function formatDate(d, fmt) { //author: meizz
    var o = {
        "M+": d.getMonth() + 1, //月份
        "d+": d.getDate(), //日
        "h+": d.getHours(), //小时
        "m+": d.getMinutes(), //分
        "s+": d.getSeconds(), //秒
        "q+": Math.floor((d.getMonth() + 3) / 3), //季度
        "S": d.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (d.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

function getQueryString(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return r[2]; return null;
}

// alert(window.location.search);

var id = getQueryString("id");
var urltoken = getQueryString("urltoken");
var name = decodeURIComponent(getQueryString("name"));
var rname = decodeURIComponent(getQueryString("rname"));

// 先关注,再发信
// followThisUser();
// postZhihuMessage(id,urltoken,name,rname);

// onlyfollowUser();

// 先点赞,后关注
// praiseFirstAnswerAndFollow();

// 先点赞,后关注,再发信
// focusTaAndSendMessageOnFirstAnswerOk(id,urltoken,name,rname);

// focusTaOnFirstAnswerOk(id,urltoken,name,rname);

