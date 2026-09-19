import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const baseCss = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/styles/base.css'),
  'utf8'
)

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('可点击控件样式', () => {
  it('可用按钮显示小手，禁用按钮显示不可操作光标', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const enabled = document.createElement('button')
    const disabled = document.createElement('button')
    disabled.disabled = true
    document.body.append(enabled, disabled)

    expect(getComputedStyle(enabled).cursor).toBe('pointer')
    expect(getComputedStyle(disabled).cursor).toBe('not-allowed')
  })

  it('队列当前歌曲标题使用跨明暗主题的正文色', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const rules = [...(style.sheet?.cssRules ?? [])] as CSSStyleRule[]
    const currentTitleRule = rules.find(
      (rule) => rule.selectorText === '.queue-panel li.current .queue-track strong'
    )

    expect(currentTitleRule?.style.color).toBe('var(--sonavi-chrome-text)')
  })

  it('连接输入框使用主题背景而不是固定白色', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const rules = [...(style.sheet?.cssRules ?? [])] as CSSStyleRule[]
    const inputRule = rules.find((rule) => rule.selectorText === '.connection-form > input')

    expect(inputRule?.style.color).toBe('var(--sonavi-ink)')
    expect(inputRule?.style.background).toBe('var(--sonavi-canvas)')
  })

  it('专辑详情固定页面并只允许歌曲列表纵向滚动', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const rules = [...(style.sheet?.cssRules ?? [])] as CSSStyleRule[]
    const workspaceRule = rules.find((rule) => rule.selectorText === '.workspace-album-detail')
    const trackListRule = rules.find((rule) => rule.selectorText === '.album-track-list')

    expect(workspaceRule?.style.overflow).toBe('hidden')
    expect(trackListRule?.style.overflowY).toBe('auto')
    expect(trackListRule?.style.overscrollBehavior).toBe('contain')
  })

  it('艺术家列表关闭外层滚动并占满工作区剩余高度', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const rules = [...(style.sheet?.cssRules ?? [])] as CSSStyleRule[]
    const workspaceRule = rules.find((rule) => rule.selectorText === '.workspace-artists-list')
    const pageRule = rules.find((rule) => rule.selectorText === '.artists-list-page')

    expect(workspaceRule?.style.overflow).toBe('hidden')
    expect(pageRule?.style.display).toBe('flex')
    expect(pageRule?.style.height).toBe('100%')
    expect(pageRule?.style.minHeight).toBe('0')
  })

  it('歌词保留滚动能力但隐藏会随自动定位闪动的视觉滚动条', () => {
    const style = document.createElement('style')
    style.textContent = baseCss
    document.head.append(style)
    const rules = [...(style.sheet?.cssRules ?? [])] as CSSStyleRule[]
    const lyricsRule = rules.find((rule) => rule.selectorText === '.lyrics-lines')
    const webkitRule = rules.find(
      (rule) => rule.selectorText === '.lyrics-lines::-webkit-scrollbar'
    )

    expect(lyricsRule?.style.scrollbarWidth).toBe('none')
    expect(lyricsRule?.style.overflowY).toBe('auto')
    expect(webkitRule?.style.display).toBe('none')
  })
})
