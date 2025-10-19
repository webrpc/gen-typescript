import {Example, VersionFromHeader, WebrpcError, WebrpcHeader} from './client.gen'

const fetchWithWebrpcHeaderParsing = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
	if (init?.headers) {
		console.log('client headers', VersionFromHeader(new Headers(init.headers)))
	}
	const res = await fetch(input, init)
	console.log('server headers', res.headers.get(WebrpcHeader))
	return res
}

const exampleClient = new Example('http://localhost:3000', fetchWithWebrpcHeaderParsing)

async function onPingClick(pingText: HTMLElement) {
	try {
		await exampleClient.ping({})
		pingText.textContent = 'PONG'
	} catch (error) {
		if (error instanceof WebrpcError) {
			console.error(error)
			pingText.textContent = `error: ${error.message}, cause: ${error.cause}`
		}
	}
}

async function onGetUserClick(usernameText: HTMLElement) {
	try {
		const { user } = await exampleClient.getUser({ userId: 1 })
		console.log('getUser() responded with:', { user })
		usernameText.textContent = user.USERNAME
	} catch (error) {
		if (error instanceof WebrpcError) {
			console.error(error)
			usernameText.textContent = `error: ${error.message}, cause: ${error.cause}`
		}
	}
}

async function onGetArticleClick(articleText: HTMLElement) {
	try {
		const article = await exampleClient.getArticle({ articleId: 1 })
		console.log('getArticle() responded with:', { article })
		articleText.textContent = `Title: ${article.title}\n\nContent: ${article.content}`
	} catch (error) {
		if (error instanceof WebrpcError) {
			console.error(error)
			articleText.textContent = `error: ${error.message}, cause: ${error.cause}`
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const pingButton = document.getElementById('js-ping-btn')
	const pingText = document.getElementById('js-ping-text')
	const getUserButton = document.getElementById('js-get-user-btn')
	const usernameText = document.getElementById('js-username-text')
	const getArticleButton = document.getElementById('js-get-article-btn')
	const articleText = document.getElementById('js-article-text')

	if (!pingButton || !pingText) {
		console.log('error getting ping HTML elements')
	} else {
		pingButton.addEventListener('click', () => onPingClick(pingText))
	}

	if (!getUserButton || !usernameText) {
		console.log('error getting username HTML elements')
	} else {
		getUserButton.addEventListener('click', () => onGetUserClick(usernameText))
	}

	if (!getArticleButton || !articleText) {
		console.log('error getting article HTML elements')
	} else {
		getArticleButton.addEventListener('click', () => { void onGetArticleClick(articleText) })
	}
})
