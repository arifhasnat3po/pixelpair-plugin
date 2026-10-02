/** @jsxRuntime classic */
/** @jsx createElement */
import { createElement, createRoot } from '@wordpress/element';
import App from './App';
import './style.scss';

const container = document.getElementById( 'pixelpair-admin' );
if ( container ) {
	createRoot( container ).render( <App /> );
}
