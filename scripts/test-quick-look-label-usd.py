"""Validate a browser-exported label with OpenUSD (requires the usd-core package).

Run test:spatial-label-browser first, then pass its apple-labeled.usdz here.
This validates USD composition; it does not emulate Apple's native AR runtime.
"""
import sys
from pxr import Usd, UsdGeom

stage = Usd.Stage.Open(sys.argv[1])
assert stage and stage.GetDefaultPrim().GetName() == "Root"
scene = stage.GetPrimAtPath("/Root/Scenes/Scene")
assert scene
behavior = scene.GetChild("AtriumLabelFacesCamera")
assert behavior.GetTypeName() == "Preliminary_Behavior"
trigger = behavior.GetChild("SceneEntered")
group = behavior.GetChild("FollowCamera")
action = group.GetChild("FaceCamera")
assert trigger.GetAttribute("info:id").Get() == "SceneTransition"
assert trigger.GetAttribute("type").Get() == "enter"
assert group.GetAttribute("loops").Get() is True
assert group.GetAttribute("performCount").Get() == 0
assert action.GetAttribute("info:id").Get() == "LookAtCamera"
assert UsdGeom.GetStageUpAxis(stage) == "Y"
assert tuple(action.GetAttribute("upVector").Get()) == (0, 1, 0), "Label rotation must preserve the stage's vertical axis"
targets = action.GetRelationship("affectedObjects").GetTargets()
assert len(targets) == 1
label = stage.GetPrimAtPath(targets[0])
assert label and label.GetName().startswith("AtriumArtworkLabel_")
assert label.GetParent() == scene
assert scene.GetChild("Artwork"), "The sculpture remains separate from its label"

for prim in Usd.PrimRange(behavior):
    for relationship in prim.GetRelationships():
        for target in relationship.GetTargets():
            assert stage.GetPrimAtPath(target), f"Unresolved behavior target: {target}"

assert not stage.GetCompositionErrors()
print("OpenUSD passed: valid packaged scene, independent label and artwork, looping camera action, resolved trigger/action targets.")
