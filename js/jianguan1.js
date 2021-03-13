/**
 * Created by sban on 2017/5/15.
 */

function getFollowBtns() {
    var btns = document.getElementsByClassName("UserLink-link");
    var links = [];

    for (var j=0;j<btns.length;j=j+2){//j+2,是因为取到的按钮每两个重复
        links.push(btns[j].href)
    }

    setTimeout(function () {
        chrome.runtime.sendMessage({"getfollowbtns":true,"btns":links});
    },1500);
}

getFollowBtns()