/**
 * Created by sban on 2017/5/15.
 */

function checkFollowMe() {
    var delay = 1000
    var btns = document.getElementsByClassName("toolbar-praise");
    // alert(btns.length)
    if (btns.length > 0 && Math.random()*100 < 5) {
        (btns[0].children[1]).click()
        delay = 2000
    }
    setTimeout(function () {
        chrome.runtime.sendMessage({"closeyoudaopage":true});
    }, delay);
}

// 对于js页面，需要给js执行的时间
setTimeout(function () {
    checkFollowMe()
}, 200);

