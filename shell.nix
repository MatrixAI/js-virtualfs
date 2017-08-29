{ pkgs ? import <nixpkgs> {} }:
  with pkgs;
  stdenv.mkDerivation {
    name = "js-virtualfs";
    buildInputs = [ python2 nodejs nodePackages.node2nix flow ];
  }
