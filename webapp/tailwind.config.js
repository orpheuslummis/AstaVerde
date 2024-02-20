/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			backgroundColor: {
				primary: "rgb(88, 172, 96)",
				secondary: "rgb(61, 155, 233)",
			},
			textColor: {
				primary: "rgb(88, 172, 96)",
				secondary: "rgb(61, 155, 233)",
			},
		},
	},
	plugins: [],
};
