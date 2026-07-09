**The 薯包 mascot illustration with idle float/bob motion.** The brand's emotional centerpiece — use it in heroes, empty states, loaders, modals, and error screens.

```jsx
<Mascot pose="superhero" size={200} anim="float" />
<Mascot src="assets/mascot-empty.webp" size={120} anim="bob" />
```

26 poses available (see `Mascot.POSES`) — match the pose to the moment: `wave`/`welcome` for greetings, `writing`/`cook`/`analyze` for loading stages, `empty`/`error`/`crash` for empty & error states, `superhero`/`jump`/`done` for success. Either pass `src`, or `pose` + a `base` dir. Remember to copy the referenced PNG into the consuming project.
