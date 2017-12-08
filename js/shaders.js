(function() {
    'use strict';

    var OSG = window.OSG;
    var osgViewer = OSG.osgViewer;
    var osgUtil = OSG.osgUtil;
    var osgShader = OSG.osgShader;

    var osgDB = OSG.osgDB;
    var requestFile = osgDB.requestFile;

    var osg = OSG.osg;

    var P = window.P;
	
	var aabb1min = [-1.0, -1.0, 1.0]; // min coords of aabb1
	var aabb1max = [1.0, 1.0, 3.0]; // max coords of aabb1
	var aabb2min = [-1.0, -1.0, -3.0]; // min coords of aabb2
	var aabb2max = [1.0, 1.0, -1.0]; // max coords of aabb2
	var hitCube;
	var seed = [0.2, 0.7]; // seed for julia shader
	var shaderPal = new osg.Texture();

    var getShader = function() {
        var vertexshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',
			
            'attribute vec3 Vertex;',
            'attribute vec3 Normal;',
			'attribute vec2 TexCoord0;',

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
			'varying vec2 vTexCoord;',
			'varying vec3 distortion;',

			// checks if the point is on the cube that is behind the mouse
			'int isOnIntersectedCube( vec3 point ) {',
			'  if(uHitCube == 1 &&(uAABB1min[0] <= point[0]) && (point[0] <= uAABB1max[0]) &&',
			'		(uAABB1min[1] <= point[1]) && (point[1] <= uAABB1max[1]) && ',
			'       (uAABB1min[2] <= point[2]) && (point[2] <= uAABB1max[2])) {', 
			'    return 1;',
			'  }',
			'  if(uHitCube == 2 &&(uAABB2min[0] <= point[0]) && (point[0] <= uAABB2max[0]) &&',
			'		(uAABB2min[1] <= point[1]) && (point[1] <= uAABB2max[1]) && ',
			'       (uAABB2min[2] <= point[2]) && (point[2] <= uAABB2max[2])) {',
			'    return 2;',
			'  }',
			'  return 0;',
            '}',
			
            'void main( void ) {',
			'  vTexCoord = TexCoord0;',
            '  vNormal = normalize( uModelViewNormalMatrix * Normal );',
			'  float t = mod( uTime * 0.5, 1000.0 ) / 1000.0;', // time [0..1]
            '  t = t > 0.5 ? 1.0 - t : t;', // [0->0.5] , [0.5->0]
            '  if ( isOnIntersectedCube( Vertex ) == 1 ) {', // each cube has its own distortion function
			'    distortion = Vertex * vec3( -cos(t * 2.0 + 3.1416 / 2.0) , -sin(t * 2.0) , cos(t * 3.0 + 3.1416 / 2.0) );',
			'    gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 )) + vec4(distortion, 1.0);',
			'  }',
			'  else if ( isOnIntersectedCube( Vertex ) == 2 ) {',
			'    distortion = Vertex * vec3( sin(t * 3.0) , -cos(t * 3.5 + 3.1416 / 2.0) , sin(t * 2.0) );',
			'    gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 )) + vec4(distortion, 1.0);',
			'  }',
            '  else {',
			'    distortion = vec3( 0.0, 0.0, 0.0 );',
			'    gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4( Vertex, 1.0 ));',
			'  }',
            '}'
        ].join('\n');

        var fragmentshader = [
            '',
            '#ifdef GL_ES',
            'precision highp float;',
            '#endif',

            'uniform float uTime;',
			'uniform sampler2D Texture0;',
			'uniform vec2 uSeed;',

            'varying vec3 vNormal;',
			'varying vec2 vTexCoord;',
			'varying vec3 distortion;',
			
			// variable for the julia shader
			'const int max_its = 60;',

			// Julia shader: http://nuclear.mutantstargoat.com/articles/sdr_fract/
            'void main( void ) {',
			'  vec2 z;',
			'  z.x = 3.0 * (vTexCoord.x - 0.5);',
			'  z.y = 2.0 * (vTexCoord.y - 0.5);',
			'  int it = 0;',
			'  for(int i = 0; i < max_its; i++) {',
			'    float x = (z.x * z.x - z.y * z.y) + uSeed.x;',
			'    float y = (z.y * z.x + z.x * z.y) + uSeed.y;',
			'    if((x * x + y * y) > 4.0) break;',
			'    z.x = x;',
			'    z.y = y;',
			'    it = i;',
			'  }',
			'  gl_FragColor = texture2D(Texture0, vec2((it == max_its ? 0.0 : float(it)) / 100.0, 0));',
//            '  float t = mod( uTime * 0.5, 1000.0 ) / 1000.0;', // time [0..1]
//            '  t = t > 0.5 ? 1.0 - t : t;', // [0->0.5] , [0.5->0]
//            '  gl_FragColor = vec4( vNormal * 0.5 + 0.5, 1.0 ) * (vec4(1.0, 1.0, 1.0, 1.0) - vec4( distortion * 0.5 + 0.5 , 1.0 ))',
//            '		               + vec4(0.69, 0.09, 0.12, 1.0) * vec4( distortion * 0.5 + 0.5 , 1.0 );',
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
	
	// taken from moving cubes example
	var createTexturedBox = function(texcoordNum, centerx, centery, centerz, sizex, sizey, sizez, l, r, b, t) {
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

        array[16] = l;
        array[17] = t;
        array[18] = l;
        array[19] = b;
        array[20] = r;
        array[21] = b;
        array[22] = r;
        array[23] = t;

        array[24] = l;
        array[25] = t;
        array[26] = l;
        array[27] = b;
        array[28] = r;
        array[29] = b;
        array[30] = r;
        array[31] = t;

        array[32] = l;
        array[33] = t;
        array[34] = l;
        array[35] = b;
        array[36] = r;
        array[37] = b;
        array[38] = r;
        array[39] = t;

        array[40] = l;
        array[41] = t;
        array[42] = l;
        array[43] = b;
        array[44] = r;
        array[45] = b;
        array[46] = r;
        array[47] = t;
		
		model.setTexCoordArray(0, array);

        return model;
    };

    var createScene = function(viewer, unifs) {
        var root = new osg.Node();
		
        osgDB.readImageURL('textures/fractalPalette.png').then(function(image) {
            shaderPal.setImage(image);
        });
		
		shaderPal.setMinFilter( 'LINEAR' );
        shaderPal.setMagFilter( 'LINEAR' );
		
		root.getOrCreateStateSet().setAttributeAndModes(getShader());
		root.getOrCreateStateSet().setTextureAttributeAndModes( 0, shaderPal );
		root.getOrCreateStateSet().addUniform(unifs.time);
		root.getOrCreateStateSet().addUniform(unifs.hitCube);
		root.getOrCreateStateSet().addUniform(unifs.aabb1min);
		root.getOrCreateStateSet().addUniform(unifs.aabb1max);
		root.getOrCreateStateSet().addUniform(unifs.aabb2min);
		root.getOrCreateStateSet().addUniform(unifs.aabb2max);
		root.getOrCreateStateSet().addUniform(unifs.seed);
		
		// puts 2 cubes in the scene
		loadCube(viewer, root, unifs, (aabb1min[0] + aabb1max[0])/2.0, (aabb1min[1] + aabb1max[1])/2.0, (aabb1min[2] + aabb1max[2])/2.0,
										(aabb1max[0] - aabb1min[0]), (aabb1max[1] - aabb1min[1]), (aabb1max[2] - aabb1min[2]));
		loadCube(viewer, root, unifs, (aabb2min[0] + aabb2max[0])/2.0, (aabb2min[1] + aabb2max[1])/2.0, (aabb2min[2] + aabb2max[2])/2.0,
										(aabb2max[0] - aabb2min[0]), (aabb2max[1] - aabb2min[1]), (aabb2max[2] - aabb2min[2]));
		
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
			hitCube: osg.Uniform.createInt1(1, 'uHitCube'),
			aabb1min: osg.Uniform.createFloat3(aabb1min, 'uAABB1min'),
			aabb1max: osg.Uniform.createFloat3(aabb1max, 'uAABB1max'),
			aabb2min: osg.Uniform.createFloat3(aabb2min, 'uAABB2min'),
			aabb2max: osg.Uniform.createFloat3(aabb2max, 'uAABB2max'),
			seed: osg.Uniform.createFloat2(seed, 'uSeed')
        };

        var viewer = new osgViewer.Viewer(canvas);
	    var cam = viewer.getCamera();
        viewer.init();
        viewer.setSceneData(createScene(viewer, unifs));
        viewer.setupManipulator();		
        viewer.run();
		
        canvas.addEventListener('mousemove', onMouseMove.bind(this, canvas, viewer, unifs), true);
    };

    window.addEventListener('load', onLoad, true);
})();
