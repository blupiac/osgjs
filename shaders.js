(function() {
    'use strict';

    var OSG = window.OSG;
    var osg = OSG.osg;
    var osgViewer = OSG.osgViewer;
    var osgDB = OSG.osgDB;

    var getShader = function() {
        var vertexshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'attribute vec3 Vertex;',
            'attribute vec3 Normal;',

            'uniform vec3 uCenterPicking;',
            'uniform mat4 uModelViewMatrix;',
            'uniform mat4 uProjectionMatrix;',
            'uniform mat3 uModelViewNormalMatrix;',

            'varying vec3 vViewVertex;',
            'varying vec3 vNormal;',
            'varying vec3 vInter;',

            'void main( void ) {',
            '  vInter = vec3( uModelViewMatrix * vec4( uCenterPicking, 1.0 ) );',
            '  vNormal = normalize( uModelViewNormalMatrix * Normal );',
            '  vViewVertex = vec3( uModelViewMatrix * vec4( Vertex, 1.0 ) );',
            '  gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 ));',
            '}'
        ].join('\n');

        var fragmentshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'uniform float uTime;',
            'uniform float uRadiusSquared;',

            'varying vec3 vViewVertex;',
            'varying vec3 vNormal;',
            'varying vec3 vInter;',

            'void main( void ) {',
            '  float t = mod( uTime * 0.5, 1000.0 ) / 1000.0;', // time [0..1]
            '  t = t > 0.5 ? 1.0 - t : t;', // [0->0.5] , [0.5->0]
            '  vec3 vecDistance = ( vViewVertex - vInter );',
            '  float dotSquared = dot( vecDistance, vecDistance );',
            '  if ( dotSquared < uRadiusSquared * 1.1 && dotSquared > uRadiusSquared*0.90 )',
            '    gl_FragColor = vec4( 0.75-t, 0.25+t, 0.0, 1.0 );',
            '  else if ( dotSquared < uRadiusSquared )',
            '    discard;',
            '  else',
            '    gl_FragColor = vec4( vNormal * 0.5 + 0.5, 1.0 );',
            '}'
        ].join('\n');

        var program = new osg.Program(
            new osg.Shader(osg.Shader.VERTEX_SHADER, vertexshader),
            new osg.Shader(osg.Shader.FRAGMENT_SHADER, fragmentshader)
        );

        return program;
    };

    var loadCube = function(viewer, node, unifs, centerx, centery, centerz, sizex, sizey, sizez, l, r, b, t) {
        var promise = window.P.resolve( osg.createTexturedBoxGeometry(centerx, centery, centerz, sizex, sizey, sizez, l, r, b, t) );

        promise.then(function(child) {
            node.addChild(child);

            child.getOrCreateStateSet().setAttributeAndModes(getShader());
            child.getOrCreateStateSet().addUniform(unifs.center);
            child.getOrCreateStateSet().addUniform(unifs.radius2);
            child.getOrCreateStateSet().addUniform(unifs.time);
            unifs.radius2.setFloat(child.getBound().radius2() * 0.02);

            // console.time( 'build' );
            var treeBuilder = new osg.KdTreeBuilder({
                _numVerticesProcessed: 0,
                _targetNumTrianglesPerLeaf: 50,
                _maxNumLevels: 20
            });
            treeBuilder.apply(node);
            // console.timeEnd( 'build' );
        });
    };
	
	var createTexturedBox = function(centerx, centery, centerz, sizex, sizey, sizez, l, r, b, t) {
        var model = osg.createTexturedBoxGeometry(centerx, centery, centerz, sizex, sizey, sizez);

        var uvs = model.getAttributes().TexCoord0;
        var array = uvs.getElements();

        array[0] = l;
        array[1] = t;
        array[2] = l;
        array[3] = b;
        array[4] = r;
        array[5] = b;
        array[6] = r;
        array[7] = t;

        array[8] = l;
        array[9] = t;
        array[10] = l;
        array[11] = b;
        array[12] = r;
        array[13] = b;
        array[14] = r;
        array[15] = t;

        array[16] = 0;
        array[17] = 0;
        array[18] = 0;
        array[19] = 0;
        array[20] = 0;
        array[21] = 0;
        array[22] = 0;
        array[23] = 0;

        array[24] = 0;
        array[25] = 0;
        array[26] = 0;
        array[27] = 0;
        array[28] = 0;
        array[29] = 0;
        array[30] = 0;
        array[31] = 0;

        array[32] = 0;
        array[33] = 0;
        array[34] = 0;
        array[35] = 0;
        array[36] = 0;
        array[37] = 0;
        array[38] = 0;
        array[39] = 0;

        array[40] = 0;
        array[41] = 0;
        array[42] = 0;
        array[43] = 0;
        array[44] = 0;
        array[45] = 0;
        array[46] = 0;
        array[47] = 0;

        return model;
    };

    var createScene = function(viewer, unifs) {
        var root = new osg.Node();

		loadCube(viewer, root, unifs, 0, 0, -2, 2, 2, 2);
		loadCube(viewer, root, unifs, 0, 0, 2, 2, 2, 2);
        root.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace(osg.CullFace.DISABLE));

        var UpdateCallback = function() {
            this.baseTime_ = new Date().getTime();
            this.update = function() {
                unifs.time.setFloat(new Date().getTime() - this.baseTime_);
                return true;
            };
        };

        root.addUpdateCallback(new UpdateCallback());

        return root;
    };

    var myReservedMatrixStack = new osg.PooledResource(osg.mat4.create);

    var projectToScreen = (function() {
        var mat = osg.mat4.create();
        var winMat = osg.mat4.create();
        return function(cam, hit) {
            osg.mat4.identity(mat);
            osg.mat4.mul(
                mat,
                mat,
                cam.getViewport() ? cam.getViewport().computeWindowMatrix(winMat) : winMat
            );
            osg.mat4.mul(mat, mat, cam.getProjectionMatrix());
            osg.mat4.mul(mat, mat, cam.getViewMatrix());

            myReservedMatrixStack.reset();
            // Node 0 in nodepath is the Camera of the Viewer, so we take next child
            osg.mat4.mul(
                mat,
                mat,
                osg.computeLocalToWorld(
                    hit._nodePath.slice(1),
                    true,
                    myReservedMatrixStack.getOrCreateObject()
                )
            );

            var pt = [0.0, 0.0, 0.0];
            osg.vec3.transformMat4(pt, hit._localIntersectionPoint, mat);
            return pt;
        };
    })();

    var onMouseMove = function(canvas, viewer, unifs, ev) {
        // console.time( 'pick' );

        // take care of retina display canvas size
        var ratioX = canvas.width / canvas.clientWidth;
        var ratioY = canvas.height / canvas.clientHeight;

        var hits = viewer.computeIntersections(
            ev.clientX * ratioX,
            (canvas.clientHeight - ev.clientY) * ratioY
        );
        // console.timeEnd( 'pick' );
        // console.log( hits.length );

        hits.sort(function(a, b) {
            return a._ratio - b._ratio;
        });

        if (hits.length === 0) return;
        var point = hits[0]._localIntersectionPoint;
        var ptFixed = [point[0].toFixed(2), point[1].toFixed(2), point[2].toFixed(2)];

        //update shader uniform
        unifs.center.setVec3(point);

        // sphere intersection
		var osgUtil = OSG.osgUtil;
		var si = new osgUtil.SphereIntersector();
		//compute world point
		//for sphere intersection
		var worldPoint = osg.vec3.create();
		myReservedMatrixStack.reset();
		osg.vec3.transformMat4(
			worldPoint,
			point,
			osg.computeLocalToWorld(
				hits[0]._nodePath.slice(1),
				true,
				myReservedMatrixStack.getOrCreateObject()
			)
		);

		si.set(
			worldPoint,
			viewer
				.getSceneData()
				.getBound()
				.radius() * 0.1
		);
		var iv = new osgUtil.IntersectionVisitor();
		iv.setIntersector(si);
		viewer.getSceneData().accept(iv);
		// console.log( si.getIntersections().length );

    };

    var onLoad = function() {
        var canvas = document.getElementById('View');

        var unifs = {
            center: osg.Uniform.createFloat3(new Float32Array(3), 'uCenterPicking'),
            radius2: osg.Uniform.createFloat1(0.1, 'uRadiusSquared'),
            time: osg.Uniform.createFloat1(0.1, 'uTime')
        };

        var viewer = new osgViewer.Viewer(canvas);
        viewer.init();
        viewer.setSceneData(createScene(viewer, unifs));
        viewer.setupManipulator();
        viewer.run();

        canvas.addEventListener('mousemove', onMouseMove.bind(this, canvas, viewer, unifs), true);
    };

    window.addEventListener('load', onLoad, true);
})();
