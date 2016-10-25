const embeddedMedia = require('./embeddedMedia');
const Scroller = require('../utils/Scroller');
const domUtils = require('../utils/dom');
const Delegate = require('dom-delegate');
const BlockOption = require('./BlockOption');
const EditForm = require('./EditForm');
const oDate = require('o-date');

function ContentContainer (webchat, actions) {
	const self = this;

	let isParticipant = false;
	let isEditor = false;
	let enableEditDelete = false;
	let contentOrder;
	let insertKeyText;


	const contentContainerEl = webchat.getDomContainer().querySelector('.webchat-content-container');
	const fadeTopEl = contentContainerEl.querySelector('.webchat-fade-top');
	const fadeBottomEl = contentContainerEl.querySelector('.webchat-fade-bottom');

	const contentEl = contentContainerEl.querySelector('.webchat-content');
	const contentDelegate = new Delegate(contentEl);


	const handleFade = function () {
		if (fixedHeight && contentEl.scrollHeight > contentEl.clientHeight) {
			if (scroller.getPosition() === 'top') {
				fadeTopEl.style.display = 'none';
				fadeBottomEl.style.display = 'block';
			} else if (scroller.getPosition() === 'bottom') {
				fadeTopEl.style.display = 'block';
				fadeBottomEl.style.display = 'none';
			} else {
				fadeTopEl.style.display = 'block';
				fadeBottomEl.style.display = 'block';
			}
		}
	};

	let fixedHeight = false;
	const scroller = new Scroller(contentEl, function () {
		handleFade();
	});

	contentDelegate.on('click', '.msg span.block', (evt) => {
		const blockElement = evt.target || evt.originalTarget || evt.srcElement;
		const messageEl = domUtils.getParents(blockElement, '.msg')[0];
		const messageId = messageEl.getAttribute('data-mid');

		actions.blockMessage({
			messageId: messageId
		}).then((success) => {
			if (success === true) {
				webchat.populateMessageField(messageEl.getAttribute("data-rawmessage"));
			}
		});
	});


	this.blockMessage = function (messageId, blockedBy) {
		const messageEl = self.findMessage(messageId);

		if (messageEl && !messageEl.classList.contains("blocked")) {
			messageEl.classList.add("blocked");
			messageEl.appendChild(domUtils.toDOM(`<span class="blocknotice">(blocked by ${blockedBy})</span>`));

			const blockElement = messageEl.querySelector('.block');
			if (blockElement) {
				blockElement.parentNode.removeChild(blockElement);
			}
		}
	};


	function isScrollAtTheEnd () {
		const position = scroller.getPosition();
		if (contentOrder === 'descending') {
			return position === 'top' || position === 'noscroll';
		} else {
			return position === 'bottom' || position === 'noscroll';
		}
	}
	function scrollToLast () {
		setTimeout(() => {
			if (contentOrder === 'descending') {
				scroller.scrollToTop();
			} else {
				scroller.scrollToBottom();
			}
		}, 50);
	}
	this.scrollToLast = scrollToLast;

	this.addSysMessage = function (details) {
		if (!details.customClass) {
			details.customClass = '';
		}

		let scrollAtTheEnd = false;
		if (isScrollAtTheEnd()) {
			scrollAtTheEnd = true;
		}

		const messageHtml = `<div class="msg sysmsg ${details.customClass}" data-mid="${details.messageId}" id="webchat-msg-${details.messageId}"><div>${details.html}</div></div>`;

		if (contentOrder === 'descending') {
			contentEl.insertBefore(domUtils.toDOM(messageHtml), contentEl.firstChild);
		} else {
			contentEl.appendChild(domUtils.toDOM(messageHtml));
		}

		if (scrollAtTheEnd || details.forceScrollToTheEnd) {
			scrollToLast();
		}

		return self.findMessage(details.messageId);
	};

	this.addEndSessionMessage = function (message) {
		contentContainerEl.appendChild(domUtils.toDOM(
			`<div class="webchat-session-ended-message">${message}</div>`
		));
	};


	this.addMessage = function (details) {
		let scrollAtTheEnd = false;
		if (isScrollAtTheEnd()) {
			scrollAtTheEnd = true;
		}

		let messageEl = self.findMessage(details.messageId);

		if (messageEl && (typeof dateModified === "undefined" || messageEl.getAttribute("data-datemodified") < details.dateModified)) {
			messageEl.parentNode.replaceChild(domUtils.toDOM(details.html), messageEl);
			messageEl = self.findMessage(details.messageId);
		} else {
			if (contentOrder === 'descending') {
				contentEl.insertBefore(domUtils.toDOM(details.html), contentEl.firstChild);
			} else {
				contentEl.appendChild(domUtils.toDOM(details.html));
			}
			messageEl = self.findMessage(details.messageId);
		}

		if (messageEl) {
			const datePublished = new Date(messageEl.getAttribute('data-timestamp') * 1000);

			const timestampEl = messageEl.querySelector('.timestamp');
			let initialTimestampValue;
			if (timestampEl) {
				initialTimestampValue = timestampEl.innerHTML;
				timestampEl.parentNode.removeChild(timestampEl);
			}

			if (!messageEl.classList.contains('separator')) {
				messageEl.appendChild(
					domUtils.toDOM(
						`<time
							class="o-date timestamp"
							data-o-component="o-date"
							data-o-date-format="h:mm a"
							datetime="${datePublished.toISOString()}"
							title="${datePublished.toDateString()} ${datePublished.toTimeString()}"
							aria-label="${datePublished.toDateString()} ${datePublished.toTimeString()}">
								${initialTimestampValue || ''}
						</time>`
					)
				);
				oDate.init(messageEl);
			} else {
				const messageBody = messageEl.querySelector('.messagebody');
				if (messageBody) {
					messageBody.innerHTML =
						`<time
							class="o-date"
							data-o-component="o-date"
							data-o-date-format="h:mm a"
							datetime="${datePublished.toISOString()}"
							title="${datePublished.toDateString()} ${datePublished.toTimeString()}"
							aria-label="${datePublished.toDateString()} ${datePublished.toTimeString()}">
								${messageBody.innerHTML}
						</time>`;
					oDate.init(messageEl);
				}
			}

			const images = messageEl.querySelectorAll('img');

			for (let i = 0; i < images.length; i++) {
				const image = images[i];
				const srcMatch = image.src.match(/\/wp-content(.*)\/emoticons\/([^.]+)/);
				if (image.classList.contains('emoticon') && srcMatch) {
					image.parentNode.replaceChild(domUtils.toDOM(`
						<span class="webchat-emoticon webchat-emoticon--${srcMatch[2]}" data-code="${srcMatch[2]}">
							${srcMatch[2].replace('-', ' ').replace('_', ' ')}
						</span>
					`), image);
				}
			}

			if (isEditor) {
				addEditDeleteOptions(messageEl);
			}

			if (isParticipant && details.blockable) {
				new BlockOption(webchat, messageEl, function () {
					if (scrollAtTheEnd || details.forceScrollToTheEnd) {
						scrollToLast();
					}
				});
			}
		}

		if (scrollAtTheEnd || details.forceScrollToTheEnd) {
			scrollToLast();

			if (messageEl) {
				const images = messageEl.querySelectorAll('img');

				for (let i = 0; i < images.length; i++) {
					const image = images[i];
					image.addEventListener('load', function () {
						scrollToLast();
					});
				}
			}
		}

		if (messageEl) {
			embeddedMedia.convert(messageEl).then(() => {
				if (scrollAtTheEnd || details.forceScrollToTheEnd) {
					scrollToLast();
				}
			});
		}
	};

	this.deleteMessage = function (messageId) {
		const messageEl = self.findMessage(messageId);
		if (messageEl) {
			messageEl.parentNode.removeChild(messageEl);
		}
	};

	function addEditDeleteOptions (el) {
		const messageHeaders = el.querySelectorAll('.messageheader');
		for (let i = 0; i < messageHeaders.length; i++) {
			const messageHeader = messageHeaders[i];

			if (enableEditDelete) {
				messageHeader.insertBefore(
					domUtils.toDOM(
						`<div class="participant-options">
							<a href="javascript:void(0)" class="participant-option-edit">Edit</a>
							<a href="javascript:void(0)" class="participant-option-delete">Delete</a>
						</div>`
					),
					messageHeader.firstChild
				);
			}
		}
	}


	function onEdit (evt) {
		const clickedButton = evt.target || evt.originalTarget || evt.srcElement;
		const messageEl = domUtils.getParents(clickedButton, '.msg')[0];
		const messageId = messageEl.getAttribute('data-mid');

		// Prevent two edit forms being added to the same message
		if (messageEl.querySelectorAll(".webchat-msg-editform").length) {
			return;
		}

		const keyText = messageEl.getAttribute("data-keytext");
		const message = messageEl.getAttribute("data-rawmessage");
		const isBlockquote = messageEl.classList.contains("blockquote");

		new EditForm(messageEl, {
			keyEventEnabled: insertKeyText ? true : false,
			keyText: keyText,
			isBlockquote: isBlockquote,
			message: message,
			messageId: messageId
		}, {
			save: (editData) => {
				return actions.editMessage(editData);
			}
		});
	}

	function onDelete (evt) {
		if (!confirm('Really delete message?')) {
			return;
		}

		const clickedButton = evt.target || evt.originalTarget || evt.srcElement;

		const messageEl = domUtils.getParents(clickedButton, '.msg')[0];
		const messageId = messageEl.getAttribute('data-mid');

		messageEl.classList.add('delete-progress');

		actions.deleteMessage({
			messageId: messageId
		}).then((success) => {
			if (success !== true) {
				messageEl.classList.remove('delete-progress');
			}
		}).catch(() => {
			messageEl.classList.remove('delete-progress');
		});
	}

	function enableParticipantOptions () {
		contentEl.classList.add('show-participant-options');

		contentDelegate.on('click', '.participant-option-edit', onEdit);
		contentDelegate.on('click', '.participant-option-delete', onDelete);
	};

	this.disableParticipantOptions = function () {
		contentEl.classList.remove('show-participant-options');

		contentDelegate.off('click', '.participant-option-edit', onEdit);
		contentDelegate.off('click', '.participant-option-delete', onDelete);
	};


	this.init = function (sessionConfig) {
		contentOrder = sessionConfig.contentOrder;
		enableEditDelete = sessionConfig.allowEditAndDeletePreviousMessages === true ? true : false;
		isParticipant = sessionConfig.isParticipant === true ? true : false;
		isEditor = sessionConfig.isEditor === true ? true : false;
		insertKeyText = sessionConfig.insertKeyText;

		if (enableEditDelete && isEditor) {
			enableParticipantOptions();
		}

		scrollToLast();
	};

	this.getDomContainer = function () {
		return contentEl;
	};

	this.setFixedHeight = function (heightPx) {
		fixedHeight = true;

		contentEl.style.height = heightPx + 'px';
		contentEl.style.overflow = "auto";
		handleFade();
	};

	this.removeFixedHeight = function () {
		fixedHeight = false;
		contentEl.style.height = 'auto';
		contentEl.style.overflow = "visible";
	};

	this.findMessage = function (messageId) {
		return contentEl.querySelector('#webchat-msg-' + messageId);
	};
}

module.exports = ContentContainer;
