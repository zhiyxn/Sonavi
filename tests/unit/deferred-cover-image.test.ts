import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import DeferredCoverImage from '../../src/renderer/src/components/DeferredCoverImage.vue'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('按可见性加载封面', () => {
  it('进入预加载区域后才设置 src，卸载时断开观察', async () => {
    let callback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    class IntersectionObserverStub {
      constructor(nextCallback: IntersectionObserverCallback) {
        callback = nextCallback
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '240px'
      thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    const wrapper = mount(DeferredCoverImage, {
      props: {
        src: 'sonavi-media://media/11111111-1111-4111-8111-111111111111',
        alt: '测试封面',
        imageClass: 'cover-image',
        placeholderClass: 'cover-placeholder'
      }
    })

    await wrapper.vm.$nextTick()
    await Promise.resolve()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(observe).toHaveBeenCalledOnce()
    callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('img').attributes()).toMatchObject({
      loading: 'lazy',
      decoding: 'async',
      fetchpriority: 'low'
    })
    expect(wrapper.get('img').attributes('src')).toContain('sonavi-media://media/')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('页面停用时移除图片请求，重新激活后再次等待进入预加载区域', async () => {
    const callbacks: IntersectionObserverCallback[] = []
    const observe = vi.fn()
    const disconnect = vi.fn()
    class IntersectionObserverStub {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback)
      }
      observe = observe
      disconnect = disconnect
      unobserve = vi.fn()
      takeRecords = vi.fn(() => [])
      root = null
      rootMargin = '240px'
      thresholds = [0]
    }
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    const visible = ref(true)
    const OtherPanel = defineComponent(() => () => h('div', '其他页面'))
    const Host = defineComponent(() => () =>
      h(KeepAlive, null, () => visible.value
        ? h(DeferredCoverImage, { src: 'sonavi-media://media/cover', alt: '测试封面' })
        : h(OtherPanel))
    )
    const wrapper = mount(Host)

    await nextTick()
    await Promise.resolve()
    callbacks.at(-1)?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
    await nextTick()
    expect(wrapper.find('img').exists()).toBe(true)

    visible.value = false
    await nextTick()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(disconnect).toHaveBeenCalled()

    visible.value = true
    await nextTick()
    await Promise.resolve()
    expect(wrapper.find('img').exists()).toBe(false)
    expect(observe).toHaveBeenCalledTimes(2)
  })
})
