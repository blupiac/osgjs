(function() {
    'use strict';

    var OSG = window.OSG;
    var osg = OSG.osg;
    var osgViewer = OSG.osgViewer;
    var osgDB = OSG.osgDB;
	
	var aabb1min = [-1.0, -1.0, 1.0]; // min coords of aabb1
	var aabb1max = [1.0, 1.0, 3.0]; // max coords of aabb1
	var aabb2min = [-1.0, -1.0, -3.0]; // min coords of aabb2
	var aabb2max = [1.0, 1.0, -1.0]; // max coords of aabb2
	var hitCube;

    var getShader = function() {
        var vertexshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'attribute vec3 Vertex;',
            'attribute vec3 Normal;',

			'uniform int uHitCube;',
			'uniform vec3 uAABB1min;',
			'uniform vec3 uAABB1max;',
			'uniform vec3 uAABB2min;',
			'uniform vec3 uAABB2max;',
			'uniform float uTime;',
			
            'uniform mat4 uModelViewMatrix;',
            'uniform mat4 uProjectionMatrix;',
            'uniform mat3 uModelViewNormalMatrix;',
			
            'varying vec3 vNormal;',
			'varying vec3 distortion;',

			'bool isOnIntersectedCube( vec3 point ) {',
            '  float epsilon = 0.001;',
			'  if(uHitCube == 1 &&(uAABB1min[0] <= point[0]) && (point[0] <= uAABB1max[0]) &&',
			'		(uAABB1min[1] <= point[1]) && (point[1] <= uAABB1max[1]) && ',
			'       (uAABB1min[2] <= point[2]) && (point[2] <= uAABB1max[2])) {', 
			'    return true;',
			'  }',
			'  if(uHitCube == 2 &&(uAABB2min[0] <= point[0]) && (point[0] <= uAABB2max[0]) &&',
			'		(uAABB2min[1] <= point[1]) && (point[1] <= uAABB2max[1]) && ',
			'       (uAABB2min[2] <= point[2]) && (point[2] <= uAABB2max[2])) {',
			'    return true;',
			'  }',
			'  return false;',
            '}',
			
            'void main( void ) {',
            '  vNormal = normalize( uModelViewNormalMatrix * Normal );',
			'  float t = mod( uTime * 0.5, 3141.6 ) / 3141.6;', // time [0..1]
            '  t = t > 0.5 ? 1.0 - t : t;', // [0->0.5] , [0.5->0]
            '  if ( isOnIntersectedCube( Vertex ) ) {',
			'    distortion = Vertex * vec3( sin(t * 5.0) , tan(t * 2.0) , sin(t * 3.0) );',
			'    gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 )) + vec4( distortion, 1.0 );',
			'  }',
            '  else',
			'    gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 ));',
            '}'
        ].join('\n');

        var fragmentshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'uniform float uTime;',

            'varying vec3 vNormal;',
			'varying vec3 distortion;',

            'void main( void ) {',
            '  float t = mod( uTime * 0.5, 1000.0 ) / 1000.0;', // time [0..1]
            '  t = t > 0.5 ? 1.0 - t : t;', // [0->0.5] , [0.5->0]
            '    gl_FragColor = vec4( vNormal * 0.5 + 0.5, 1.0 ) + vec4( distortion , 1.0 );',
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
		
		root.getOrCreateStateSet().setAttributeAndModes(getShader());
		root.getOrCreateStateSet().addUniform(unifs.time);
		root.getOrCreateStateSet().addUniform(unifs.hitCube);
		root.getOrCreateStateSet().addUniform(unifs.aabb1min);
		root.getOrCreateStateSet().addUniform(unifs.aabb1max);
		root.getOrCreateStateSet().addUniform(unifs.aabb2min);
		root.getOrCreateStateSet().addUniform(unifs.aabb2max);
		
		// puts 2 cubes in the scene
		loadCube(viewer, root, unifs, (aabb1min[0] + aabb1max[0])/2.0, (aabb1min[1] + aabb1max[1])/2.0, (aabb1min[2] + aabb1max[2])/2.0,
										(aabb1max[0] - aabb1min[0]), (aabb1max[1] - aabb1min[1]), (aabb1max[2] - aabb1min[2]));
		loadCube(viewer, root, unifs, (aabb2min[0] + aabb2max[0])/2.0, (aabb2min[1] + aabb2max[1])/2.0, (aabb2min[2] + aabb2max[2])/2.0,
										(aabb2max[0] - aabb2min[0]), (aabb2max[1] - aabb2min[1]), (aabb2max[2] - aabb2min[2]));
        root.getOrCreateStateSet().setAttributeAndModes(new osg.CullFace(osg.CullFace.DISABLE));
		
        var UpdateCallback = function() {
            this.baseTime_ = new Date().getTime();
            this.update = function() {
                unifs.time.setFloat(new Date().getTime() - this.baseTime_);
				unifs.hitCube.setInt(hitCube);
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

	var insideAABB = function(point, min, max) {
		var epsilon = 0.001;
		if((min[0] - point[0]) < epsilon && (point[0] - max[0]) < epsilon &&
			(min[1] - point[1]) < epsilon && (point[1] - max[1]) < epsilon &&
			(min[2] - point[2]) < epsilon && (point[2] - max[2]) < epsilon)
		{
			return true;
		}
		else		
		{
			return false;
		}
	};
	
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

        if (hits.length === 0)
		{
			hitCube = 0;
			return;
		}
        var point = hits[0]._localIntersectionPoint;
		
		if(insideAABB(point, aabb1min, aabb1max))
		{
			hitCube = 1;
		}
		else if(insideAABB(point, aabb2min, aabb2max))
		{
			hitCube = 2;
		}

    };

    var onLoad = function() {
        var canvas = document.getElementById('View');
		
        var unifs = {
            time: osg.Uniform.createFloat1(0.1, 'uTime'),
		    time2: osg.Uniform.createInt1(0.1, 'uTime2'),
			hitCube: osg.Uniform.createInt1(1, 'uHitCube'),
			aabb1min: osg.Uniform.createFloat3(aabb1min, 'uAABB1min'),
			aabb1max: osg.Uniform.createFloat3(aabb1max, 'uAABB1max'),
			aabb2min: osg.Uniform.createFloat3(aabb2min, 'uAABB2min'),
			aabb2max: osg.Uniform.createFloat3(aabb2max, 'uAABB2max')
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
