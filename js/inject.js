chrome.runtime.onMessage.addListener(function(res){
			if(res.action == "INJECT_JS_DEPENDENCE"){
        var libs = res.data;
        for(var i = 0 ; i < libs.length ; i++){
          creatScript(libs[i].url);
        }
			}
});

function creatScript(url) {
  var script=document.createElement("script");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", url);
    document.documentElement.appendChild(script);
}
