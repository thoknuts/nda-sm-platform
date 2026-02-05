import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function DynamicFavicon() {
  useEffect(() => {
    async function loadFavicon() {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('favicon_url')
          .eq('id', 1)
          .single()

        if (error) {
          // Silently ignore - favicon_url column may not exist
          return
        }

        if (data?.favicon_url) {
          // Update favicon
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
          if (!link) {
            link = document.createElement('link')
            link.rel = 'icon'
            document.head.appendChild(link)
          }
          link.href = data.favicon_url
        }
      } catch {
        // Silently ignore favicon errors
      }
    }

    loadFavicon()
  }, [])

  return null
}
