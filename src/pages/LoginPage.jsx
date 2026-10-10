import '../styles/LoginPage.css'

function LoginPage({ onSubmit }) {
	function handleSubmit(event) {
		event.preventDefault()
		onSubmit()
	}

	return (
		<main className="login-page">
			<section aria-labelledby="login-title" className="login-panel">
				<p className="login-eyebrow">Welcome back</p>
				<h1 id="login-title">Log in to Mangos</h1>
				<p className="login-description">Pick up where your English practice left off.</p>

				<form className="login-form" onSubmit={handleSubmit}>
					<label htmlFor="username">Username</label>
					<input
						autoComplete="username"
						id="username"
						name="username"
						placeholder="Your username"
						required
					/>

					<label htmlFor="password">Password</label>
					<input
						autoComplete="current-password"
						id="password"
						name="password"
						placeholder="Your password"
						required
						type="password"
					/>

					<button className="login-submit" type="submit">Log in</button>
				</form>
				<p className="login-demo-note">Demo mode: any username and password will work.</p>
			</section>
		</main>
	)
}

export default LoginPage


