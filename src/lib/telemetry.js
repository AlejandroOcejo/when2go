import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let initialized = false

function isPlaceholderKey(key) {
  if (!key) {
    return true
  }

  const normalized = String(key).trim()

  return (
    normalized.length === 0 ||
    normalized === 'phc_your_project_api_key' ||
    normalized.includes('your_project')
  )
}

export function initAnalytics(userId) {
  if (initialized || isPlaceholderKey(POSTHOG_KEY)) {
    return
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: 'identified_only',
  })

  initialized = true

  if (userId) {
    posthog.identify(userId)
  }
}

export function identifyAnalyticsUser(userId) {
  if (!initialized || !userId) {
    return
  }

  posthog.identify(userId)
}

export function trackEvent(eventName, properties = {}) {
  if (!initialized) {
    return
  }

  posthog.capture(eventName, properties)
}
