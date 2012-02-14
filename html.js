/*
    html.js

	License: MIT license - http://www.opensource.org/licenses/mit-license.php
*/

"use strict"

var HTML

!function (HTML, global) {

	var flagname = "__htmljs" + Date.now().toString()
	var html = {}

	function Create(val) { return Observable.Create.apply(this, arguments) }
	function Define(fun) { return Observable.Define.apply(this, arguments) }

	function exportMethods(source, dest) {
		for (var i in source)
			if (source.hasOwnProperty(i) && dest[i] == null && typeof source[i] == "function") {
				0,function (i) {
					dest[i] = function () { return source[i].apply(this, arguments) }
				}(i)
			}
	}

	HTML.exportTo = function (dest) {
		exportMethods(html, dest)
		exportMethods(Observable, dest)
	}

	function checkFun(v) { return typeof v == "function" ? call(v) : v }

	function call(fun) {
		var a = []
		for (var i = 0; i < fun.length; i++)
			a.push(Create())
		return fun.apply(null, a)
	}

	function forPairs(obj, fun) {
		for (var i in obj)
			fun(i, obj[i])
	}

	function planeArray(a) {
		var ret = []
		loop(a)
		return ret
		function loop(a) {
			if (a instanceof Array)
				a.forEach(loop)
			else if (a != null)
				ret.push(a)
		}
	}

	function processNode(node, content, placeholder) {
		var root = typeof node == "string" ? document.createElement(node)
			: (node == document ? document.documentElement : node)
		processChildren(content, appendDefault)
		placeholder = null
		return root

		/*
		'insert' and 'remove' methods in custom nodes must take root as a parameter to break
		dependencies and to allow garbage collector to do the work
		*/

		function appendDefault(child) {
			if (child instanceof Node) {
				if (placeholder)
					root.insertBefore(child, placeholder)
				else
					root.appendChild(child)
			}
			else if (child.apply)
				child.apply(root)
		}

		function processChildren(content, appendChild) {
			if (content == null)
				return
			else if (content instanceof Array)
				content.forEach(function (a) { processChildren(a, appendChild) })
			else if (content instanceof Node)
				appendChild(content)
			else if (typeof content == "function")
				appendCode(content, true)
			else if (typeof content != "object" || content instanceof String || content instanceof Number)
				appendChild(document.createTextNode(content))
			else
				forPairs(content, function pair(i, a) {
					if (i == "checked" && root instanceof HTMLInputElement) {
						rootProp(i, a)
						if (typeof a == "function")
							rootEvent("onchange", function () {
								a(root[i])
							})
					}
					else if (typeof a == "function") {
						if (i.substr(0, 2) != "on")
							appendMemberFun(a)
						else
							rootEvent(i, a)
					}
					else if (i == "style")
						forPairs(a, styleProp)
					else if (i == "NODE")
						forPairs(a, rootProp)
					else if (i == "data") {
						if (global.jQuery) forPairs(a, function (j, value) {
							appendChild({
								name: "data_" + j,
								apply: function (root) {
									global.jQuery(root).data(j, value)
								},
								restore: function (root) {
									global.jQuery(root).data(j, null)
								}
							})
						})
					}
					else {
						if (i == "class" && !(a instanceof Array))
							a = [a]
						if (a instanceof Array) {
							// var attr = root.getAttributeNode(i)
							// if (!attr) {
							// 	attr = document.createAttribute(i)
							// 	root.appendAttribute(attr)
							// }
							// root.setAttribute(i, a)
							// appendChild(attr)
							// var va = root.getAttribute(i).split(" ")
							// var fa = []
							// !function recurse(a) {
							// 	a.forEach(function (a) {
							// 		if (typeof a == "function")
							// 			fa.push(a)
							// 		else {
							//
							// 		}
							// 	})
							// }(a)
							a = planeArray(a)
							if (a.some(function (i) { return typeof i == "function" }))
								return appendMemberFun(function () { return a.map(function (v) {
									return checkFun(v)
								}) })
							a = a.join(" ")
						}
						var oldValue = root.getAttribute(i)
						appendChild({
							name: "attribute_" + i,
							apply: function (root) {
								root.setAttribute(i, a)
							},
							restore: function (root) {
								if (oldValue == null)
									root.removeAttribute(i)
								else
									root.setAttribute(i, oldValue)
							}
						})
					}
					function rootEvent(i, a) {
						if (global.jQuery) {
							i = escape(i.substr(2))
							appendChild({
								name: "event_" + i,
								apply: function (root) {
									global.jQuery(root).on(i, a)
								},
								restore: function (root) {
									global.jQuery(root).off(i, a)
								}
							})
						}
						else {
							appendChild({
								name: "event_" + i,
								apply: function (root) {
									root[i] = a
								},
								restore: function (root) {
									root[i] = null
								}
							})
						}
					}
					function styleProp(j, value) {
						if (typeof value == "function") {
							var v = Create()
							// cache intermediate result
							childDefine(value.priority, function () {
								var x = value
								do { x = call(x) } while (typeof x == "function")
								v(x)
							})
							appendCode(function () {
								var style = {}
								style[j] = v()
								return {style: style}
							}, false)
						}
						else {
							var oldValue = root[j]
							appendChild({
								name: "style_" + j,
								apply: function (root) {
									root.style[j] = value
								},
								restore: function (root) {
									root.style[j] = oldValue
								}
							})
						}
					}
					function rootProp(j, value) {
						if (typeof value == "function") {
							var v = Create()
							// cache intermediate result
							childDefine(value.priority, function () {
								var x = value
								do { x = call(x) } while (typeof x == "function")
								v(x)
							})
							appendCode(function () {
								var NODE = {}
								NODE[j] = v()
								return {NODE: NODE}
							}, false)
						}
						else {
							var oldValue = root[j]
							appendChild({
								name: "NODE_" + j,
								apply: function (root) {
									root[j] = value
								},
								restore: function (root) {
									root[j] = oldValue
								}
							})
						}
					}
					function appendMemberFun(value) {
						var v = Create()
						childDefine(value.priority, function () { v(value()) }) // cache intermediate result
						appendCode(function () {
							var ret = {}
							ret[i] = v()
							return ret
						}, false)
					}
				})

			function childDefine(priority, fun) {
				var subscription = Define(priority, fun)
				subscription.run() // force run for the first time to reduce touching of DOM
				appendChild({
					name: null,
					restore: function () { subscription.dispose() }
				})
			}

			function appendCode(fun, domChanging) {
				var first
				var nodes
				var action
				var flag
				var placeholder

				var action = function initNode(values) {
					action = updateNode
					doProcessChildren(values, appendChild)
				}

				childDefine(fun.priority, function () {
					var values = []
					var previous = currentWriteHandler
					currentWriteHandler = values.push.bind(values)
					try {
						currentWriteHandler(call(fun))
					}
					finally {
						currentWriteHandler = previous
					}
					action(planeArray(values))
				})

				function doProcessChildren(values, appendChild) {
					var nodeCreated = false
					var last
					var items = {}
					nodes && nodes.forEach(function (n) {
						if (!(n instanceof Node) && n.name)
							items[n.name] = n
					})
					var ac = function (child) {
						if (!(child instanceof Node)) {
							if (child.name) {
								var cache = items[child.name]
								if (cache) {
									cache.apply = child.apply
									child = cache
								}
							}
						}
						else if (domChanging) {
							if (!first)
								first = child
							last = child
						}
						child[flagname] = flag
						nodes.push(child)
						appendChild(child)
					}
					nodes = []
					flag = {}
					first = null
					processChildren(values, ac)
					if (domChanging && (!first ||
						// prevent browser optimization — concatenation of text nodes
						last instanceof Text
					)) {
						ac(placeholder || (placeholder = document.createComment("")))
					}
				}

				function updateNode(values) {
					var current = first
					while (current && current.previousSibling && current.previousSibling[flagname] == flag)
						current = current.previousSibling
					var oldNodes = nodes
					doProcessChildren(values, function (child) {
						if (current == child)
							current = current.nextSibling
						else if (current && child instanceof Node)
							root.insertBefore(child, current)
						else
							appendDefault(child)
					})
					oldNodes.forEach(function (n) {
						if (n[flagname] != flag)
							if (n instanceof Node) {
								root.removeChild(n)
								if (n.onDetachObservable)
									n.onDetachObservable()
							}
							else if (n.restore)
								n.restore(root)
					})
				}
			}
		}
	}

	html.NODE = function NODE(node) {
		return processNode(node, Array.slice(arguments, 1))
	}

	html.H = html.CLASS = function CLASS(class_) { // !!!!!!!!!!!!! does not work ???
		return processNode("div", { class: class_ }, Array.slice(arguments, 1))
	}

	html.ID = function ID(id) {
		return processNode("div", { id: id }, Array.slice(arguments, 1))
	}

	!["p", "div", "span", "br", "a", "li", "ol", "ul", "canvas", "img", "input", "form", "textarea", "label",
		"fieldset", "legend", "select", "optgroup", "option", "button", "datalist", "keygen", "output", "title",
		"body", "script", "meta"
	].forEach(function (name) {
		html[name.toUpperCase()] = function () {
			return processNode(name, Array.slice(arguments))
		}
	}, this)

	!["checkbox", "color", "email", "file", "hidden", "image", "number", "password", "radio", "range",
		"reset", "search", "submit", "tel", "url"
	].forEach(function (name) {
		html[name.toUpperCase()] = function () {
			return processNode("input", [{type: name}, Array.slice(arguments)])
		}
	})

	html.TEXT = function (text) {
		return document.createTextNode(text)
	}

	html.CHECKED = function (variable, value, checked) {
		if (!checked)
			checked = Create(false)
		Define(
			function () { checked(variable() == value) },
			function () { if (checked()) variable(value) })
		return {checked: checked}
	}

	function makePlaceHolder() {
		// 'script' might be created both in the head and in the body
		document.write("<script id='" + flagname + "'></script>")
		var placeholder = document.getElementById(flagname)
		placeholder.removeAttribute("id")
		return placeholder
	}

	function currentWriteHandler() {
		if (document.readyState != "loading")
			throw "document already loaded"
		var placeholder = makePlaceHolder()
		var parent = placeholder.parentElement
		try {
			processNode(parent, Array.slice(arguments), placeholder)
		}
		finally {
			parent.removeChild(placeholder)
		}
	}

	html.WRITE = function () {
		// currentWriteHandler may be changed. see processNode.
		currentWriteHandler.apply(null, arguments)
	}

	html.SOURCE = function (f) {
		f = f.toString()
		var s = f.indexOf("{")
		var e = f.indexOf("}")
		var l = e - s - 1
		s++
		return f.substr(s, l)
	}

	HTML.exportTo(HTML)

	function getParameters() {
		var placeholder = makePlaceHolder()
		var parent = placeholder.parentElement
		var script = placeholder.previousSibling
		parent.removeChild(placeholder)
		return (script.src.match(/\#(.*)$/) || ["", ""])[1].split("&").map(unescape)
	}

	getParameters().some(function (param) {
		switch (param) {
			case "stop": return true
			case "global": HTML.exportTo(global); break
		}
	})

	return HTML
}(HTML || (HTML = {}), this)
