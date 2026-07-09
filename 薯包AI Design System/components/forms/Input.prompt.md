**Clay-inset text field** with coral focus ring. Single-line or textarea.

```jsx
<Input label="主题" icon={<Hash size={16} />} placeholder="云南3天2夜旅游攻略" value={v} onChange={e=>setV(e.target.value)} />
<Input as="textarea" rows={5} placeholder="输入你想创作的主题，一句话就够了…" />
```

Use `as="textarea"` for the main generation prompt. Pass `label` to render a bold field label above.
