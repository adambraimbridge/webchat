const Api = require('./data/NewApi');
//const Api = require('./data/Api');
const domUtils = require('./utils/dom');
const RealTimeStream = require('./data/RealTimeStream');
const Time = require('./utils/Time');

const EditorContainer = require('./ui/EditorContainer');
const ContentContainer = require('./ui/ContentContainer');
const ParticipantContainer = require('./ui/ParticipantContainer');
const HeaderContainer = require('./ui/HeaderContainer');
const templates = require('./ui/templates');

function Webchat (rootEl, config) {
	let widgetEl;
	let self;

	self = this;

	try {
		if (!rootEl) {
			widgetEl = document.body;
		} else if (!(rootEl instanceof HTMLElement)) { // could throw exception in IE
			widgetEl = document.querySelector(rootEl);
		} else {
			widgetEl = rootEl;
		}
	} catch (e) {
		let el;
		if (typeof rootEl === 'string') {
			el = document.querySelector(rootEl);
		}

		if (el) {
			widgetEl = el;
		} else {
			widgetEl = document.body;
		}
	}

	/**
	 * Validation of the initial configuration object.
	 */
	if (!config) {
		throw new Error("No config provided");
	}

	if (!config.articleId) {
		if (!config.articleid) {
			throw new Error("Article ID is not provided.");
		} else {
			config.articleId = config.articleid;
		}
	}

	if (!config.apiUrl) {
		throw new Error("API URL is not provided.");
	}

	this.getDomContainer = function () {
		return widgetEl;
	};



	const api = new Api(config.apiUrl);

	widgetEl.appendChild(domUtils.toDOM(templates.container.render()));

	this.headerContainer = new HeaderContainer(self);
	this.contentContainer = new ContentContainer(self, {
		blockMessage: blockMessage,
		deleteMessage: deleteMessage,
		editMessage: editMessage
	});
	this.editorContainer = new EditorContainer(self, {
		sendMessage: sendMessage,
		startSession: startSession,
		endSession: endSession
	});
	this.participantContainer = new ParticipantContainer(self);

	let time;
	let stream;
	let sessionConfig = {};


	function failedResponse (err) {
		console.log('An error occured, error:', err);
		self.showAlert('An error occured.');

		throw err;
	}

	function unsuccessfulActionRequest (response) {
		if (response && typeof response === 'object') {
			self.showAlert(response.reason);
		} else {
			self.showAlert('Action failed, unknown reason.');
		}
	}


	this.init = function () {
		api.init().catch(failedResponse).then((initResponse) => {
			if (initResponse.success !== true) {
				unsuccessfulActionRequest(initResponse);
				return;
			}

			sessionConfig = initResponse.data;

			self.headerContainer.setLozenge(sessionConfig.sessionStatus);

			time = new Time(sessionConfig.time);

			if (!sessionConfig.contentOrder) {
				sessionConfig.contentOrder = 'descending';
			}

			if (sessionConfig.isParticipant === true) {
				self.editorContainer.init(sessionConfig);
			}

			sessionConfig.participants.forEach((participant) => {
				self.participantContainer.addParticipant({
					color: participant.color,
					fullName: participant.displayName,
					shortName: participant.initials,
					displayStyle: sessionConfig.authorNameStyle
				});
			});

			self.contentContainer.init(sessionConfig);


			api.catchup({
				direction: (sessionConfig.contentOrder === "descending" ? "reverse" : "") + "chronological"
			}).catch(failedResponse).then((catchupResponse) => {
				if (catchupResponse.success !== true) {
					unsuccessfulActionRequest(catchupResponse);
				}

				if (catchupResponse.data && catchupResponse.data.length) {
					catchupResponse.data.forEach((evt) => {
						switch (evt.event) {
							case 'msg':
							case 'editmsg':
								onMessage(evt.data, true);
								break;

							case 'delete':
								onDeleteMessage(evt.data);
								break;

							case 'postSaved':
								self.headerContainer.setExcerpt(evt.data.excerpt);
								self.headerContainer.setTitle(evt.data.title);
								break;

							case 'end':
								onEndSession();
								break;
						}
					});
				}

				if (sessionConfig.fixedHeight) {
					setTimeout(function () {
						resize();
					}, 100);
				}

				if (sessionConfig.sessionStatus !== 'closed') {
					initStream(sessionConfig);
				}
			});
		});
	};

	this.serverTime = function () {
		return time.serverTime();
	};


	function resize () {
		const viewportHeight = domUtils.windowSize().height;
		const chatPadding = 10;
		const nonChatHeight = domUtils.offset(widgetEl).top + chatPadding;
		const editorHeight = self.editorContainer.getDomContainer().scrollHeight;
		const participantHeight = self.participantContainer.getDomContainer().scrollHeight;

		self.contentContainer.setFixedHeight(viewportHeight - nonChatHeight - editorHeight - participantHeight - nonChatHeight);
	}


	function blockMessage (data) {
		return api.message.block(data).catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
	}

	function deleteMessage(data) {
		return api.message.delete(data).catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
	}

	function sendMessage (data) {
		return api.message.send(data).catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
	}

	function editMessage (data) {
		return api.message.edit(data).catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
	}

	function startSession () {
		if (!confirm('START SESSION NOW?\n\nThe session will be started immediately (there will be no delay). Once started, there is no way to go back to the "Coming soon" state.\n\nAre you sure you want to start the session now?')) {
			return Promise.resolve(false);
		}

		return api.session.start().catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
    }

    function endSession() {
		if (!confirm('End session now?')) {
			return Promise.resolve(false);
		}

		return api.session.end().catch(failedResponse).then((response) => {
			if (response.success === true) {
				return true;
			} else {
				unsuccessfulActionRequest(response);
				return false;
			}
		});
	}



	function onMessage (data, catchup) {
		if (data.author) {
			if (!self.participantContainer.containsParticipant(data.author)) {
				self.participantContainer.addParticipant({
					color: data.authorcolour,
					fullName: data.authordisplayname,
					shortName: data.author,
					displayStyle: sessionConfig.authorNameStyle
				});
			}
		}

		self.contentContainer.addMessage({
			html: data.html,
			messageId: data.mid,
			dateModified: data.datemodified,
			blockable: catchup === true ? false : true,
			forceScrollToTheEnd: catchup === true ? true : false
		});

		if (sessionConfig.insertKeyText && data.keytext) {
			self.headerContainer.addKeypoint({
				keyText: data.keytext,
				id: data.mid
			});
		}
	}

	function onBlockMessage (data) {
		self.contentContainer.blockMessage(data.msgblocked, data.blockedby);
	}

	function onDeleteMessage (data) {
		self.contentContainer.deleteMessage(data.messageid);

		if (sessionConfig.insertKeyText) {
			self.headerContainer.removeKeypoint(data.messageid);
		}
	}

	function onStartSession () {
		sessionConfig.sessionStatus = 'inprogress';

		self.contentContainer.addSysMessage({
			messageId: 'webchat-msg-session-started',
			html: 'This session is now in progress.',
			forceScrollToTheEnd: true
		});

		self.editorContainer.sessionStarted();
		self.headerContainer.setLozenge(sessionConfig.sessionStatus);
    }

    function onEndSession () {
    	sessionConfig.sessionStatus = 'closed';

    	if (stream) {
    		stream.stop();
    	}

        self.contentContainer.addSysMessage({
        	messageId: 'webchat-msg-session-ended',
        	html: `This session has now closed, and <a href="${document.location.href.replace(document.location.hash, "")}">is available here</a>.`,
        	forceScrollToTheEnd: true
        });

        self.contentContainer.disableParticipantOptions();
        self.editorContainer.sessionEnded();
        self.headerContainer.setLozenge(sessionConfig.sessionStatus);

        resize();
    }



	this.showAlert = function (message) {
		window.alert(message);
	};

	function initStream () {
		stream = new RealTimeStream({
			channel: sessionConfig.channel,
			pusherKey: sessionConfig.pusherKey,
			articleId: config.articleId,
			api: api
		});

		const connectMessage = self.contentContainer.addSysMessage({
			html: "Connecting to stream &hellip;",
			messageId: 'stream-connect'
		});
		const connectMessageContainer = connectMessage.querySelector('div');
		connectMessageContainer.innerHTML = "Connecting to the stream &hellip;";

		stream.on('connected', () => {
			connectMessageContainer.innerHTML = sessionConfig.connectionNotification;
		});

		stream.on('msg', onMessage);
		stream.on('editmsg', onMessage);
		stream.on('block', onBlockMessage);
		stream.on('delete', onDeleteMessage);
		stream.on('end', onEndSession);
		stream.on('startSession', onStartSession);
	}

	this.populateMessageField = function (value) {
		self.editorContainer.populateMessageField(value);
	};


	if (config.autoInit !== false) {
		self.init();
	}
}

module.exports = Webchat;
