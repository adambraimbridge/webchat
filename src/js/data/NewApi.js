const httpRequest = require('../utils/httpRequest');
const merge = require('../utils/merge');

function parseQuery (qstr) {
	const query = {};
	const a = qstr.substr(1).split('&');

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== "") {
			const b = a[i].split('=');
			query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
		}
	}

	return query;
}

function Api (baseUrl) {
	this.init = function () {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.get({
			url: baseUrl,
			query: merge({}, queryStr, {
				action: 'init',
				format: 'json'
			}),
			dataType: 'json'
		}).then((response) => {
			const normalizedResponse = merge({}, response);
			delete normalizedResponse.data;

			normalizedResponse.data = {
				allowEditAndDeletePreviousMessages: response.data.alloweditanddeletepreviousmessages,
				authorNameStyle: response.data.authornamestyle,
				channel: response.data.channel,
				connectionNotification: response.data.connection_notification,
				contentOrder: response.data.content_order,
				fixedHeight: response.data.fixed_height === true ? true : false,
				isParticipant: response.data.isparticipant === true ? true : false,
				isEditor: response.data.iseditor === true ? true : false,
				participants: [],
				sessionStatus: response.data.status,
				pusherKey: response.data.pusherkey,

				initialPollingWaitTime: response.data.initial_polling_wait_time,
				pollInterval: response.data.pollInterval,

				time: response.data.time
			};

			if (response.data.participants && response.data.participants.length) {
				response.data.participants.forEach((participant) => {
					normalizedResponse.data.participants.push({
						userId: participant.user_id,
						displayName: participant.display_name,
						email: participant.email,
						initials: participant.initials,
						isWpUser: participant.is_wp_user === true ? true : false,
						token: participant.token,
						headshot: participant.headshot
					});
				});
			}

			return normalizedResponse;
		});
	};

	this.poll = function () {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.get({
			url: baseUrl,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'poll',
				format: 'json'
			})
		});
	};

	this.catchup = function (query) {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.get({
			url: baseUrl,
			query: merge(queryStr, query, {
				action: 'catchup',
				format: 'json'
			}),
			dataType: 'json'
		});
	};

	this.session = {};
	this.session.start = function () {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'startSession',
				format: 'json'
			})
		});
	};

	this.session.end = function () {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'end',
				format: 'json'
			})
		});
	};

	this.message = {};
	this.message.send = function (postData) {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			body: postData,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'sendmsg',
				format: 'json'
			})
		});
	};

	this.message.block = function (postData) {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			body: postData,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'block',
				format: 'json'
			})
		});
	};

	this.message.edit = function (postData) {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			body: postData,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'editmsg',
				format: 'json'
			})
		});
	};

	this.message.delete = function (postData) {
		const queryStr = parseQuery(document.location.search);

		return httpRequest.post({
			url: baseUrl,
			body: postData,
			dataType: 'json',
			query: merge(queryStr, {
				action: 'deletemsg',
				format: 'json'
			})
		});
	};

}

module.exports = Api;