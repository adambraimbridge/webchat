import Overlay from 'o-overlay';
import Delegate from 'ftdomdelegate';

function serialize (form) {
	const s = {};

	for (let i = 0; i < form.elements.length; i++) {
		const field = form.elements[i];
		if (field.name && !field.disabled && field.type !== 'file' && field.type !== 'reset' && field.type !== 'submit' && field.type !== 'button') {
			if (field.type === 'select-multiple') {
				for (let j = form.elements[i].options.length-1; j >= 0; j--) {
					if(field.options[j].selected) {
						s[field.name] = field.options[j].value;
					}
				}
			} else if ((field.type !== 'checkbox' && field.type !== 'radio') || field.checked) {
				s[field.name] = field.value;
			}
		}
	}

	return s;
}

function generateFormHtml (fields) {
	let html = '<div>';
	if (fields && fields.length) {
		fields.forEach(field => {

			if (field.type === 'static-text' && field.label) {
				html += `<p>${field.label}</p>`;
			}

			if (field.type === 'text') {
				html += `
					<label class="o-forms-field">
						${field.label ? `
						<span class="o-forms-title">
							<span class="o-forms-title__main">${field.label}</span>
						</span>` : ''}

						<span class="o-forms-input o-forms-input--text">
							<input type="text" name="${field.name}" value="${field.value || ''}" placeholder="${field.placeholder || ''}" ${field.attributes ? Object.keys(field.attributes).map(key => `${key}="${field.attributes[key]}"`).join(' ') : ''} >
						</span>
					</label>
				`;
			}
		});
	}

	html += '</div>';

	return html;
};

function FormOverlay (options) {
	const title = options.title || '';
	const submitLabel = options.submitLabel;
	const fields = options.fields || {};
	const modal = options.modal === false ? false : true;

	return new Promise((resolve) => {
		const overlayInstance = new Overlay("alphaville_confirm", {
			html: `
				<form>
					<div class="alphaville-overlay-form-content">${generateFormHtml(fields)}</div>
					<div class="alphaville-overlay-buttons">
						${submitLabel ? `<button type="submit" class="alphaville-overlay-submit o-buttons o-buttons--primary">${submitLabel}</button>` : ''}
						<button type="button" class="alphaville-overlay-cancel o-buttons o-buttons--secondary">${submitLabel ? 'Cancel' : 'Close'}</button>
					</div>
				</form>
			`,
			modal: modal,
			heading: {
				title: title,
				shaded: true
			}
		});

		overlayInstance.open();

		const formOverlayDelegate = new Delegate(overlayInstance.wrapper);

		formOverlayDelegate.on('click', '.alphaville-overlay-cancel', () => {
			resolve(false);
			overlayInstance.close();
		});

		const onSubmit = (evt) => {
			resolve(serialize(evt.target));
			overlayInstance.close();
			evt.preventDefault();
			return false;
		};

		formOverlayDelegate.on('oOverlay.ready', () => {
			const formEl = overlayInstance.wrapper.querySelector('form');

			if (submitLabel) {
				formEl.addEventListener('submit', onSubmit);
			}
		});

		const onDestroy = function () {
			if (overlayInstance.wrapper.querySelector('form') && submitLabel) {
				overlayInstance.wrapper.querySelector('form').removeEventListener('submit', onSubmit);
			}
			overlayInstance.wrapper.removeEventListener('oOverlay.destroy', onDestroy);
			formOverlayDelegate.destroy();
		};
		overlayInstance.wrapper.addEventListener('oOverlay.destroy', onDestroy);
	});
}

module.exports = FormOverlay;
