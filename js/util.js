function sleep(ms) {
    const p = new Promise(
        resolve => {
            console.log("sellep", ms);
            setTimeout(resolve, ms)
        })
    return p
}

export {
    sleep
}