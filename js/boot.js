// 全局命名空间桥：微信小游戏里通过 require 共享，浏览器里挂在 window 上
var G = {};
if (typeof module !== 'undefined' && module.exports !== undefined) { module.exports = G; }
if (typeof window !== 'undefined') { window.G = G; }
if (typeof GameGlobal !== 'undefined') { GameGlobal.G = G; }
