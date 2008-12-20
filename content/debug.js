if ( debugLocal ) {

var iviewfx;
var self = iviewfx = {
	doc: null,
	initEventHandlers: function (tab) {
		this.doc = document;
		this.doc.addEventListener("iview-ipc-from-contentWindow", function (msg) {
			var json = eval("(" + msg.getData('json') + ")" );
			var f = self["ipc_" + json.event];
			if ( typeof f == 'function' ) {
				f.call(self, json);
			}
		}, false );
	},
	ipc_page_load: function (json) {
			(new IPC(document)).sendMessage( {
				event: 'feeds',
				feeds: [
				{
					id: 400,
					title: "Big Picture",
				},
				{
					id: 401,
					title: "kiyo tumblr",
					url: "http://kiyo.tumblr.com/api/read?type=photo"
				},
				]
			} );
	}
};
iviewfx.initEventHandlers();

}

