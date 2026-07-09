import re

with open('shubao-final.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_i = """const I = {
  s1: '/images/cropped_13.png',
  s2: '/images/cropped_14.png',
  s3: '/images/cropped_15.png',
  s4: '/images/cropped_16.png',
  s5: '/images/cropped_17.png',
  wave: '/images/cropped_8.png',
  stand: '/images/cropped_9.png',
  excited: '/images/cropped_10.png',
  happy: '/images/cropped_11.png',
  appicon: '/images/cropped.png',
  logo: '/images/cropped_2.png',
  welcome: '/images/cropped_12.png',
  think: '/images/cropped_18.png',
  upgrade: '/images/cropped_19.png',
  loading: '/images/cropped_20.png',
  result: '/images/cropped_21.png',
  publish: '/images/cropped_22.png',
  tip: '/images/cropped_23.png',
  banner: '/images/cropped_24.png',
  idea: '/images/cropped_25.png',
  success: '/images/cropped_26.png',
  protect: '/images/cropped_27.png',
  scene: '/images/cropped_1.png',
  walk: '/images/walk.png',
  'wave-hand': '/images/wave-hand.png',
  jump: '/images/jump.png',
  ready: '/images/ready.png',
  sit: '/images/sit.png',
  surf: '/images/surf.png',
  meditate: '/images/meditate.png',
  cook: '/images/cook.png',
  dance: '/images/dance.png',
  done: '/images/done.png',
  superhero: '/images/superhero.png',
  curator: '/images/curator.png',
  inspect: '/images/inspect.png',
  photographer: '/images/photographer.png',
  lift: '/images/lift.png',
};"""

if old_i in content:
    new_i = "const I = (()=>{const m={};for(const[k,v]of Object.entries({" + \
      "s1:'/images/cropped_13.png',s2:'/images/cropped_14.png',s3:'/images/cropped_15.png'," + \
      "s4:'/images/cropped_16.png',s5:'/images/cropped_17.png'," + \
      "wave:'/images/cropped_8.png',stand:'/images/cropped_9.png'," + \
      "excited:'/images/cropped_10.png',happy:'/images/cropped_11.png'," + \
      "appicon:'/images/cropped.png',logo:'/images/cropped_2.png'," + \
      "welcome:'/images/cropped_12.png',think:'/images/cropped_18.png'," + \
      "upgrade:'/images/cropped_19.png',loading:'/images/cropped_20.png'," + \
      "result:'/images/cropped_21.png',publish:'/images/cropped_22.png'," + \
      "tip:'/images/cropped_23.png',banner:'/images/cropped_24.png'," + \
      "idea:'/images/cropped_25.png',success:'/images/cropped_26.png'," + \
      "protect:'/images/cropped_27.png',scene:'/images/cropped_1.png'," + \
      "walk:'/images/walk.png','wave-hand':'/images/wave-hand.png'," + \
      "jump:'/images/jump.png',ready:'/images/ready.png'," + \
      "sit:'/images/sit.png',surf:'/images/surf.png'," + \
      "meditate:'/images/meditate.png',cook:'/images/cook.png'," + \
      "dance:'/images/dance.png',done:'/images/done.png'," + \
      "superhero:'/images/superhero.png',curator:'/images/curator.png'," + \
      "inspect:'/images/inspect.png',photographer:'/images/photographer.png'," + \
      "lift:'/images/lift.png'})){m[k]=new URL(v,import.meta.url).href}return m;})();"

    content = content.replace(old_i, new_i)
    with open('shubao-final.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ DONE")
else:
    print("❌ No match")
PYEOF