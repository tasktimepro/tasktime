/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontSize: {
                '0': '0px'
            },
            keyframes: {
                'toast-enter': {
                  '0%': { transform: 'translateY(1rem)', opacity: '0' },
                  '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                'toast-exit': {
                  '0%': { transform: 'translateY(0)', opacity: '1' },
                  '100%': { transform: 'translateY(1rem)', opacity: '0' }
                }
            },
            animation: {
                'toast-enter': 'toast-enter 0.3s ease-out forwards',
                'toast-exit': 'toast-exit 0.3s ease-in forwards'
            }
        },
    },
    plugins: [],
}
