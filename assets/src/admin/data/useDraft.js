import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const pick = ( settings, keys ) =>
	Object.fromEntries( keys.map( ( key ) => [ key, settings[ key ] ] ) );

export function useDraft( settings, keys, save ) {
	const source = JSON.stringify( pick( settings, keys ) );
	const [ baseline, setBaseline ] = useState( source );
	const [ values, setValues ] = useState( () => JSON.parse( source ) );
	const [ busy, setBusy ] = useState( false );
	const [ message, setMessage ] = useState( '' );
	const dirty = JSON.stringify( values ) !== baseline;
	useEffect( () => {
		if ( ! dirty && ! busy ) {
			setBaseline( source );
			setValues( JSON.parse( source ) );
		}
	}, [ source, busy ] ); // eslint-disable-line react-hooks/exhaustive-deps -- Resync saved responses after completion; draft edits must not reset themselves.
	const change = ( key, value ) => {
		setValues( ( old ) => ( { ...old, [ key ]: value } ) );
		setMessage( '' );
	};
	const discard = () => {
		setValues( JSON.parse( source ) );
		setBaseline( source );
		setMessage( '' );
	};
	const submit = async ( extra = {} ) => {
		if ( busy ) {
			return false;
		}
		const previous = JSON.parse( baseline );
		const changed = Object.fromEntries(
			Object.entries( values ).filter(
				( [ key, value ] ) =>
					JSON.stringify( value ) !==
					JSON.stringify( previous[ key ] )
			)
		);
		setBusy( true );
		setMessage( '' );
		try {
			const success = await save( { ...changed, ...extra } );
			if ( success ) {
				setBaseline( JSON.stringify( values ) );
				setMessage( __( 'Changes saved', 'pixelpair' ) );
			}
			return !! success;
		} finally {
			setBusy( false );
		}
	};
	return { values, change, dirty, busy, submit, discard, message, setValues };
}
