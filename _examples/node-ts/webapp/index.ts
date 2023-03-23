import { ExampleService, WebrpcError } from './client.gen'

const exampleService = new ExampleService('http://localhost:3000', fetch)

document.addEventListener('DOMContentLoaded', () => {
	const pingButton = document.getElementById('js-ping-btn')
	const pingText = document.getElementById('js-ping-text')

	if (!pingButton || !pingText) {
		console.log('error getting ping HTML elements')
		return
	}

	pingButton.addEventListener('click', () => {
		exampleService
			.ping({})
			.then(({}) => {
				pingText.textContent = 'PONG'
			})
			.catch((error) => {
				if (error as WebrpcError) {
					console.error(error)
					pingText.textContent = `error: ${error.message}, cause: ${error.cause}`
				}
			})
	})
})

document.addEventListener('DOMContentLoaded', () => {
	const getUserButton = document.getElementById('js-get-user-btn')
	const usernameText = document.getElementById('js-username-text')

	if (!getUserButton || !usernameText) {
		console.log('error getting username HTML elements')
		return
	}

	getUserButton.addEventListener('click', () => {
		exampleService
			.getUser({
				userID: 1,
			})
			.then(({ user }) => {
				console.log('getUser() responded with:', { user })
				usernameText.textContent = user.USERNAME
			})
			.catch((error) => {
				if (error as WebrpcError) {
					console.error(error)
					usernameText.textContent = `error: ${error.message}, cause: ${error.cause}`
				}
			})
	})
})
