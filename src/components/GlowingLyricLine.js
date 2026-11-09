import React,{memo,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Text,View} from 'react-native';

// Only the active line (and its fading predecessor) renders the glow layers.
export default memo(function GlowingLyricLine({children,active,style,onLayout}){
 const opacity=useRef(new Animated.Value(active?1:0)).current;
 const [glow,setGlow]=useState(active);
 const reduced=useRef(false);
 useEffect(()=>{
  let live=true;
  AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live)reduced.current=value;});
  const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced.current=value;});
  return()=>{live=false;subscription.remove();};
 },[]);
 useEffect(()=>{
  if(active)setGlow(true);
  const animation=Animated.timing(opacity,{toValue:active?1:0,duration:reduced.current?0:280,useNativeDriver:true});
  animation.start(({finished})=>{if(finished&&!active)setGlow(false);});
  return()=>animation.stop();
 },[active,opacity]);
 return <View onLayout={onLayout} style={{marginBottom:17}}>
  <Text selectable style={[style,{marginBottom:0,color:'#b8b5c6'}]}>{children}</Text>
  {glow&&<Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{position:'absolute',top:0,left:0,right:0,opacity}}>
    {[[-0.45,0],[0.45,0],[0,-0.45],[0,0.45]].map(([x,y],i)=>
      <Text key={i} accessible={false} style={[style,{position:'absolute',top:y,left:x,right:-x,marginBottom:0,color:'rgba(255,255,255,0.65)',textShadowRadius:0}]}>{children}</Text>)}
    <Text accessible={false} style={[style,{marginBottom:0,color:'#ffffff',textShadowColor:'rgba(255,255,255,0.65)',textShadowOffset:{width:0,height:0},textShadowRadius:6}]}>{children}</Text>
  </Animated.View>}
 </View>;
});
