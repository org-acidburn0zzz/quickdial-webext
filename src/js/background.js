var core = {}; // Main app object in background.js
var app = {};  // Shared app object with pages

core._init = function(){ // Called from core.Settings.load()
	core.Bookmarks.initRoot(function(){
		core.GridNodes.sync(app.settings.grid.node, app.settings.grid.root); // Sync bookmarks with stored data
		core.ContextMenus.initMenu();
		core.Bookmarks.initListener();
	})
}

core.Settings = {}; // Settings helper object
core.Settings.load = function(){ // Load settings and call core.init
	browser.storage.local.get({
		background: '#3c4048',
		grid: {
			margin: 10,
			rows: 4,
			columns: 5,
			cells: {
				margin: 4,
				ratioX: 4,
				ratioY: 3,
				borderColor: '#333333',
				borderColorHover: '#a9a9a9',
				borderRadius: 4,
				title: true,
				titleHeight: 18,
				titleFontSize: 11,
				titleFont: 'Arial, Verdana, Sans-serif',
				titleColor: '#ffffff',
				titleColorHover: '#33ccff',
				backPanel: true,
				backIcon: 'img/back.png',
				folderIcon: 'img/folder.png',
				loadingIcon: 'img/throbber.gif'
			},
			root: 'Quick Dial',
			node: {}
		}
	}).then(function(obj){
		app.settings = obj;
		core._init();
	},function(){});
}
core.Settings.save = function(){ // Save settings
	browser.storage.local.set(app.settings);
}
core.Settings.load(); // Need to be loaded first and call core.init when ready

core.ContextMenus = {} // ContextMenu helper Object
core.ContextMenus.initMenu = function(){ // (Called from core._init) Init context menu in all pages
	browser.contextMenus.create({ // Create Context menu
		id: 'AddToQuickDial',
		title: browser.i18n.getMessage("menuAddToQuickDial"),
		contexts: ["all"],
		documentUrlPatterns: [ 'http://*/*', 'https://*/*', 'file://*/*' ]
	}, function(){});
	browser.contextMenus.onClicked.addListener(function(info, tab) { // Context menu click event
		if (info.menuItemId == "AddToQuickDial")
			core.GridNodes.createBookmark(app.settings.grid.node, info.pageUrl, tab.title, function(){});
	});
}

core.Bookmarks = {} // Bookmarks helper object
core.Bookmarks.initListener = function(){ // (Called from core._init) (/!\ Need filter to root tree only) Init listener of bookmarks
	function notifyBookmarksChanged(){ core.GridNodes.sync(app.settings.grid.node, app.settings.grid.root); }
	browser.bookmarks.onCreated.addListener(notifyBookmarksChanged);
	browser.bookmarks.onChanged.addListener(notifyBookmarksChanged);
	browser.bookmarks.onMoved.addListener(notifyBookmarksChanged);
	browser.bookmarks.onRemoved.addListener(notifyBookmarksChanged);		
}
core.Bookmarks.initRoot = function(callback){ // (Called from core._init) Create the root folder if not exist
	browser.bookmarks.getSubTree('menu________').then(function(bookmarkItems){
		getChildItem = function(bookmarkItem, path, callback){
			if(path.length == 0){
				if(callback) callback(bookmarkItem);
				return;
			}
			for(var child of bookmarkItem.children){
				if((path + '/').startsWith(child.title + '/')){
					getChildItem(child, path.substr(child.title.length + 1), callback);
					return;
				}
			}
			browser.bookmarks.create({
				parentId: bookmarkItem.id,
				title: path.substr(0, (path + '/').indexOf('/'))
			}).then(callback);
		}
		getChildItem(bookmarkItems[0], app.settings.grid.root, callback);
	}, function(){
		console.log('Can not load bookmarks');
		if(callback) callback(null);
	});
}
core.Bookmarks.load = function(rootPath, callback){ // callback(bookmarkItem) Return BookmarkItem from rootPath
	browser.bookmarks.getSubTree('menu________').then(function(bookmarkItems){
		if(callback) callback(core.Bookmarks.getItem(bookmarkItems[0], rootPath + '/'))
	}, function(){
		console.log('Can not load bookmarks');
		if(callback) callback(null);
	});
}
core.Bookmarks.getItem = function(bookmarkItem, path){ // Return BookmarkItem from path from bookmarkItem as root
	if(path.length == 0) return bookmarkItem;
	for(var child of bookmarkItem.children)
		if(path.startsWith(child.title + '/'))
			return core.Bookmarks.getItem(child, path.substr(child.title.length + 1));
	return null;
}

core.SiteInfos = {} // Siteinfos helper object
core.SiteInfos.fromTab = function(callback){ // Retrieve infos from current tab. callback( { url, title, icon, screenshot } || error: callback() )
	browser.tabs.getCurrent().then(function(tab){
		function whaitLoaded(){
			browser.tabs.get(tab.id).then(function(tab){
				if(tab.status == 'loading') setTimeout(whaitLoaded, 300);
				else{
					browser.tabs.update(tab.id, {active: true}).then(function(){
						setTimeout(function(){
							browser.tabs.captureVisibleTab().then(function(img){
								browser.tabs.remove(tab.id);
								if(callback) callback( { url: tab.url, title: tab.title, icon: tab.favIconUrl, screenshot: img } );
							}, function(){
								browser.tabs.remove(tab.id);
								if(callback) callback();
							});
						}, 300);
					}, function(){
						if(callback) callback();
					});
				}
			}, function(){
				if(callback) callback();
			});
		}
		setTimeout(whaitLoaded, 300);
	}, function(){
		if(callback) callback();
	});
}
core.SiteInfos.fromNewTab = function(url, callback){  // Retrieve infos from a new tab. callback( { url, title, icon, screenshot } || error: callback() )
	browser.tabs.create({url: url, active: false}).then(function(tab){
		browser.tabs.update(tab.id, {muted: true}).then();
		function whaitLoaded(){
			browser.tabs.get(tab.id).then(function(tab){
				if(tab.status == 'loading') setTimeout(whaitLoaded, 300);
				else{
					browser.tabs.update(tab.id, {active: true}).then(function(){
						setTimeout(function(){
							browser.tabs.captureVisibleTab().then(function(img){
								browser.tabs.remove(tab.id);
								if(callback) callback( { url: tab.url, title: tab.title, icon: tab.favIconUrl, screenshot: img } );
							}, function(){
								browser.tabs.remove(tab.id);
								if(callback) callback();
							});
						}, 300);
					}, function(){
						if(callback) callback();
					});
				}
			}, function(){
				if(callback) callback();
			});
		}
		setTimeout(whaitLoaded, 300);
	}, function(){
		if(callback) callback();
	});
}
core.SiteInfos.fromFrame = function(url, callback){ // Retrieve infos from an iframe. callback( { url, title, (/!\ Not handled now)icon, screenshot } || error: callback() )
	function pageLoaded(){
		if(!iframe) return;
		var docTitle = iframe.contentWindow.document.title;
		var docIcon = null;
		var docScreenshot = null;
		//title
		if(docTitle == '') docTitle = url;
		//icon
		//screenshot
		var canvas = document.createElement('canvas');
		canvas.style.width = previewWidth.toString() + 'px';
		canvas.style.height = previewHeight.toString() + 'px';
		canvas.width = previewWidth / 2;
		canvas.height = previewHeight / 2;
		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, previewWidth, previewHeight);
		ctx.save();
		ctx.scale(0.5, 0.5);
		ctx.drawWindow(iframe.contentWindow, 0, 0, previewWidth, previewHeight, 'rgb(255, 255, 255)');
		ctx.restore();
		docScreenshot = canvas.toDataURL();

		document.body.removeChild(iframe);
		iframe = null;
		if(callback) callback({ url: url, title: docTitle, icon: docIcon, screenshot:docScreenshot });
	}

	var previewWidth = 1200; // Need to be linked to settings
	var previewHeight = 710; // Need to be linked to settings
	var iframe;
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.timeout = 10000
	xmlHttp.open('GET', url, true);
	xmlHttp.onload = function(){
		iframe = document.createElement('iframe');
		iframe.width = previewWidth
		iframe.height = previewHeight
		iframe.style.position = 'absolute';
		//iframe.style.visibility = 'hidden';
		var content = xmlHttp.responseText.replace('<head>', '<head><base href="' + url + '">');
		iframe.onload = function(){ pageLoaded(); }
		document.body.appendChild(iframe);
		iframe.srcdoc = content;
		setTimeout(function(){ pageLoaded(); }, 6000);
	}
	xmlHttp.onabort = function(){ if(callback) callback(); }
	xmlHttp.onerror = function(){ if(callback) callback(); }
	xmlHttp.ontimeout = function(){ if(callback) callback(); }
	xmlHttp.send();
}
core.SiteInfos.fromWS = function(url, callback){ // Retrieve infos from a Web Service. callback( { url, title, (/!\ Not handled now)icon, screenshot } || error: callback() )
	console.log('Not implemented');
	return core.SiteInfos.fromFrame(url, callback);
}

core.GridNodes = {}; // GridNodes helper object
core.GridNodes.sync = function(gridNode, rootPath){ // Sync GridNodes with Bookmarks
	core.Bookmarks.load(rootPath, function(bookmarkItem){
		core.GridNodes.syncItem(gridNode, bookmarkItem);
		browser.runtime.sendMessage({ command: 'gridNodesSynced'}).then(function(){}, function(){});
		core.Settings.save();
	});
}
core.GridNodes.syncItem = function(gridNode, bookmarkItem){ // Sync GridNode with BookmarkItem
	gridNode.id = bookmarkItem.id;
	gridNode.title = bookmarkItem.title; // /!\ Need check last update
	if(bookmarkItem.url){
		gridNode.type = 'bookmark';
		gridNode.url = bookmarkItem.url; // /!\ Need check last update
	} else if(bookmarkItem.children){
		gridNode.type = 'folder';
		var EmptyItems = [];
		if(! gridNode.children) gridNode.children = [];
		else {
			for(var i=gridNode.children.length-1; i>=0; i--){
				if(gridNode.children[i].type!='empty'){
					var found = false;
					for(var child of bookmarkItem.children){
						if(child.id==gridNode.children[i].id){
							found = true;
							break;
						}
					}
					if(! found){
						if(i<gridNode.children.length - 1){
							gridNode.children[i] = { type: 'empty' };
							EmptyItems.unshift(gridNode.children[i]);
						} else{
							gridNode.children.pop();
						}
					}
				}else {
					EmptyItems.unshift(gridNode.children[i]);
				}
			}
		}
		for(var child of bookmarkItem.children){
			var childGridNode = core.GridNodes.getChild(gridNode, child.id);
			if(!childGridNode){
				if(EmptyItems.length>0){
					childGridNode = EmptyItems[0];
					EmptyItems.shift();
				}else {
					childGridNode = {};
					gridNode.children.push(childGridNode)
				}
			}
			core.GridNodes.syncItem(childGridNode, child);
		}
		EmptyItems.length = 0;
	} else node.type = 'empty';
}
core.GridNodes.getChild = function(gridNode, id){ // Return child node by ID
	for(var child of gridNode.children) if(child.id == id) return child;
	return null;
}
core.GridNodes.getNode = function(gridNode, path){ // Return GridNode from RootGridNode path
	if(path.length == 0 || path == '/') return gridNode;
	for(var child of gridNode.children)
		if(path.startsWith(child.title + '/'))
			return core.GridNodes.getNode(child, path.substr(child.title.length + 1));
	return null;
}
core.GridNodes.refreshNode = function(gridNode, callback){ // Refresh content of a GridNode
	if(gridNode.__isLoading == true) return;
	gridNode.__isLoading = true;
	core.SiteInfos.fromFrame(gridNode.url, function(infos){
		if(infos){
			gridNode.title = infos.title;
			gridNode.image = infos.screenshot;
			browser.bookmarks.update(gridNode.id, {
				title: infos.title
			}).then(function(bookmarkItem){}, function(){});
			core.Settings.save();
		}
		gridNode.__isLoading = false;
		if(callback) callback(infos);
	});
}
core.GridNodes.createFolder = function(gridNode, name, callback){ // Create a new folder in a GridNode
	browser.bookmarks.create({
		parentId: gridNode.id,
		title: name
	}).then(callback);
}
core.GridNodes.createBookmark = function(gridNode, url, title, callback){ // Create a new Bookmark in a GridNode
	browser.bookmarks.create({
		parentId: gridNode.id,
		title: title || url,
		url: url
	}).then(callback);				
}
core.GridNodes.delete = function(id, callback){ // Delete a GridNode
	browser.bookmarks.removeTree(id).then(callback);
}
core.GridNodes.setNodeIndex = function(gridNode, index, newIndex, callback){ // Set Child GridNodeIndex
	while(newIndex>=gridNode.children.length){
		gridNode.children.push({ type: 'empty' });
	}
	var node1 = gridNode.children[index];
	var node2 = gridNode.children[newIndex];
	gridNode.children[index] = node2;
	gridNode.children[newIndex] = node1;
	core.Settings.save();
	if(callback) callback();
	browser.runtime.sendMessage({ command: 'gridNodesSynced'}).then(function(){}, function(){});
}
core.GridNodes.capturePage = function(gridNode, callback){
	browser.tabs.create({url: gridNode.url, active: false}).then(function(tab){
		browser.tabs.update(tab.id, {muted: true}).then(function(){}, function(){});
		function whaitLoaded(){
			browser.tabs.get(tab.id).then(function(tab){
				if(tab.status == 'loading'){
					setTimeout(whaitLoaded, 300);
				} else{
					browser.tabs.update(tab.id, {active: true}).then(function(){
						setTimeout(function(){
							browser.tabs.captureVisibleTab().then(function(img){
								browser.tabs.remove(tab.id);
								gridNode.title = tab.title
								gridNode.image = img;
								browser.bookmarks.update(gridNode.id, {
									title: gridNode.title
								}).then(function(bookmarkItem){}, function(){});
								core.Settings.save();
								if(callback) callback();
								browser.runtime.sendMessage({ command: 'gridNodesSynced'}).then(function(){}, function(){});
							}, function(){
								browser.tabs.remove(tab.id);
								if(callback) callback();
							});
						}, 300);
					}, function(){
						if(callback) callback();
					});
				}
			}, function(){});
			
		}
		setTimeout(whaitLoaded, 300);
	}, function(){
		if(callback) callback();
	});
}

// Public functions
app.refreshNode = core.GridNodes.refreshNode;
app.getNode = core.GridNodes.getNode;
app.createFolder = core.GridNodes.createFolder;
app.createBookmark = core.GridNodes.createBookmark;
app.deleteNode = core.GridNodes.delete;
app.setNodeIndex = core.GridNodes.setNodeIndex;
app.capturePage = core.GridNodes.capturePage;