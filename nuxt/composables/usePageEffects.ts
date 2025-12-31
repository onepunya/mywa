import { ref, type Ref } from 'vue'

type Theme = 'light' | 'dark'

interface UsePageEffectsReturn {
   theme: Ref<Theme>
   isScrolled: Ref<boolean>
   toggleTheme: () => void
}

const theme: Ref<Theme> = ref('dark')
const isScrolled: Ref<boolean> = ref(false)

if (process.client) {
   const savedTheme = localStorage.getItem('theme')
   const initialTheme = (savedTheme === 'dark' ? 'dark' : 'light') as Theme

   if (initialTheme === 'dark') {
      document.body.classList.remove('light-mode')
   } else {
      document.body.classList.add('light-mode')
   }
   theme.value = initialTheme

   const handleScroll = () => {
      isScrolled.value = window.scrollY > 10
   }

   window.addEventListener('scroll', handleScroll)

   handleScroll()
}

export function usePageEffects(): UsePageEffectsReturn {
   const applyTheme = (newTheme: Theme) => {
      if (typeof document === 'undefined') return
      if (newTheme === 'dark') {
         document.body.classList.remove('light-mode')
      } else {
         document.body.classList.add('light-mode')
      }
      localStorage.setItem('theme', newTheme)
      theme.value = newTheme
   }

   const toggleTheme = () => {
      applyTheme(theme.value === 'dark' ? 'light' : 'dark')
   }

   return {
      theme,
      isScrolled,
      toggleTheme
   }
}