**Soft clay-raised surface — the default container for content.** Optional gradient header band recreates the Xiaohongshu note-cover look.

```jsx
<Card hover header={<h3 style={{color:'#fff',margin:0}}>反向旅游5个小县城</h3>} gradient="var(--grad-sunset)">
  <p>谁懂啊！这5个小县城真的绝了…</p>
</Card>
```

Variants: `raised` (clay depth, default), `plain` (flat subtle shadow), `gradient`. Set `hover` for the springy lift. Use `header`/`gradient`/`headerHeight` for note covers; omit them for a plain padded card.
