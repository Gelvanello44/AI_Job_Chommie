// Lightweight payments helpers
// Note: Never store or use secret keys here. Only public config is allowed.

export async function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true)
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve(true)
    s.onerror = () => reject(new Error(`Failed to load script ${src}`))
    document.body.appendChild(s)
  })
}

export async function initPaystackInline({ key, email, amountKobo, reference, metadata = {}, onSuccess, onCancel, onError }) {
  try {
    await loadExternalScript('https://js.paystack.co/v1/inline.js')
    if (!window.PaystackPop) throw new Error('Paystack SDK not available')

    const handler = window.PaystackPop.setup({
      key,
      email,
      amount: amountKobo, // amount in kobo/cents
      currency: 'ZAR',
      ref: reference,
      metadata,
      callback: function (resp) {
        onSuccess?.(resp)
      },
      onClose: function () {
        onCancel?.()
      },
    })

    handler.openIframe()
  } catch (err) {
    onError?.(err)
  }
}

// Initialize Yoco payment inline popup
export async function initYocoInline({ key, email, amountCents, reference, metadata = {}, onSuccess, onCancel, onError }) {
  try {
    await loadExternalScript('https://js.yoco.com/sdk/v1/yoco-sdk-web.js')
    if (!window.Yoco) throw new Error('Yoco SDK not available')

    const yoco = new window.Yoco({
      publicKey: key
    })

    yoco.showPopup({
      amountInCents: amountCents,
      currency: 'ZAR',
      description: metadata.description || `Payment for ${metadata.plan || 'subscription'}`,
      metadata: {
        email,
        reference,
        ...metadata
      },
      callback: function(result) {
        if (result.error) {
          onError?.(result.error)
        } else {
          onSuccess?.(result)
        }
      },
      onClose: function() {
        onCancel?.()
      }
    })
  } catch (err) {
    onError?.(err)
  }
}

// Generic payment initialization that works with both providers
export async function initiatePayment({ provider, key, email, amount, reference, metadata = {}, onSuccess, onCancel, onError }) {
  if (provider === 'paystack') {
    return initPaystackInline({ key, email, amountKobo: amount, reference, metadata, onSuccess, onCancel, onError })
  } else if (provider === 'yoco') {
    return initYocoInline({ key, email, amountCents: amount, reference, metadata, onSuccess, onCancel, onError })
  } else {
    throw new Error(`Unknown payment provider: ${provider}`)
  }
}
